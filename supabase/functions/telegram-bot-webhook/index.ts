// Telegram bot webhook: send a booking ID (UUID) to the bot, get back booking
// summary + offer PDF + financial claim PDF (only to the chat that asked).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmtNum = (n: number) => Number(n || 0).toLocaleString("en-US");

async function sendMessage(token: string, chat_id: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return new Response("no bot token", { status: 500 });

  // Optional shared-secret check (set when registering the webhook)
  const expectedSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (expectedSecret) {
    const got = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (got !== expectedSecret) return new Response("unauthorized", { status: 401 });
  }

  let update: any;
  try { update = await req.json(); } catch { return new Response("bad json", { status: 200 }); }

  const msg = update?.message ?? update?.edited_message;
  const chat_id = msg?.chat?.id;
  const text: string = (msg?.text || "").trim();
  if (!chat_id || !text) return new Response("ok");

  const m = text.match(UUID_RE);
  if (!m) {
    if (/^\/start|help/i.test(text)) {
      await sendMessage(token, chat_id, "👋 ابعت ID الحجز (UUID) وهبعتلك بياناته + عرض التأجير + المطالبة المالية.");
    }
    return new Response("ok");
  }
  const bookingId = m[0];

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supaUrl, svc);

  const { data: booking, error: bErr } = await admin
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (bErr || !booking) {
    await sendMessage(token, chat_id, `❌ لا يوجد حجز بهذا الـ ID:\n<code>${esc(bookingId)}</code>`);
    return new Response("ok");
  }

  const { data: bUnits } = await admin
    .from("booking_units")
    .select("*")
    .eq("booking_id", bookingId)
    .order("building_number")
    .order("unit_number");

  const units = (bUnits || []).map((u: any) => ({
    buildingNumber: u.building_number,
    unitNumber: u.unit_number,
    unitType: u.unit_type,
    area: Number(u.area || 0),
    activity: u.activity,
    price: Number(u.price || 0),
  }));

  const totalArea = units.reduce((s, u) => s + u.area, 0);
  const totalPrice = units.reduce((s, u) => s + u.price, 0);

  const lines: string[] = [];
  lines.push("🗂️ <b>بيانات الحجز</b>");
  lines.push(`🆔 <code>${esc(booking.id)}</code>`);
  if (booking.offer_number) lines.push(`📄 رقم العرض: <b>${esc(booking.offer_number)}</b>`);
  lines.push(`📌 الحالة: ${esc(booking.status)}`);
  lines.push(`🧮 نظام السداد: ${esc(booking.payment_plan || "full")}`);
  lines.push("");
  lines.push("👤 <b>العميل</b>");
  lines.push(`• ${esc(booking.customer_full_name)}`);
  if (booking.customer_phone) lines.push(`• 📞 ${esc(booking.customer_phone)}`);
  if (booking.customer_email) lines.push(`• ✉️ ${esc(booking.customer_email)}`);
  if (booking.business_name) lines.push(`• 🏢 ${esc(booking.business_name)}`);
  if (booking.cr_number) lines.push(`• الرقم الوطني الموحد: ${esc(booking.cr_number)}`);
  lines.push("");
  lines.push(`📦 الوحدات (${units.length}):`);
  units.forEach((u, i) => {
    lines.push(`  ${i + 1}. مبنى ${u.buildingNumber} — وحدة ${u.unitNumber} — ${fmtNum(u.area)} م² — ${fmtNum(u.price)} ر.س`);
  });
  lines.push("");
  lines.push(`📐 إجمالي المساحات: <b>${fmtNum(totalArea)}</b> م²`);
  lines.push(`💰 إجمالي الإيجار السنوي: <b>${fmtNum(totalPrice)}</b> ر.س`);

  await sendMessage(token, chat_id, lines.join("\n"));
  await sendMessage(token, chat_id, "⏳ جاري إعداد عرض التأجير والمطالبة المالية...");

  const customer = {
    fullName: booking.customer_full_name,
    phone: booking.customer_phone,
    email: booking.customer_email,
    business: booking.business_name,
    notes: booking.notes,
    crNumber: booking.cr_number,
  };

  const basePayload = {
    booking_id: booking.id,
    payment_plan: booking.payment_plan || "full",
    target_chat_id: String(chat_id),
    customer,
    units,
  };

  // Fire both PDFs in parallel; each will deliver to this chat only.
  const callFn = async (name: string, payload: any) => {
    try {
      const r = await fetch(`${supaUrl}/functions/v1/${name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${svc}`,
          "apikey": svc,
        },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        await sendMessage(token, chat_id, `⚠️ فشل ${name}: ${esc(t.slice(0, 300))}`);
      }
    } catch (e) {
      await sendMessage(token, chat_id, `⚠️ خطأ ${name}: ${esc((e as Error).message)}`);
    }
  };

  await Promise.all([
    callFn("send-offer-pdf", basePayload),
    callFn("send-financial-claim-pdf", { ...basePayload, customer: { ...customer } }),
  ]);

  return new Response("ok");
});
