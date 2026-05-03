import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface Unit {
  buildingNumber: number;
  buildingType?: string;
  unitNumber: number;
  unitType?: string | null;
  area: number;
  activity?: string | null;
  price: number;
}

interface Payload {
  booking_id?: string;
  customer: {
    fullName: string;
    phone: string;
    email?: string;
    business?: string;
    notes?: string;
  };
  units: Unit[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatIdsRaw = Deno.env.get("TELEGRAM_CHAT_IDS");
    if (!token || !chatIdsRaw) throw new Error("Telegram secrets not configured");

    const chatIds = chatIdsRaw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    const body = (await req.json()) as Payload;

    if (!body?.customer?.fullName || !Array.isArray(body.units) || body.units.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalArea = body.units.reduce((s, u) => s + (Number(u.area) || 0), 0);
    const totalPrice = body.units.reduce((s, u) => s + (Number(u.price) || 0), 0);
    const date = new Date().toLocaleString("ar-EG-u-nu-latn", { timeZone: "Asia/Riyadh" });

    const esc = (s: string) =>
      String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const lines: string[] = [];
    lines.push("🏢 <b>طلب حجز جديد - المدينة الصناعية شمال مكة</b>");
    if (body.booking_id) lines.push(`🆔 <code>${esc(body.booking_id)}</code>`);
    lines.push("");
    lines.push("👤 <b>بيانات العميل</b>");
    lines.push(`• الاسم: ${esc(body.customer.fullName)}`);
    lines.push(`• الجوال: ${esc(body.customer.phone)}`);
    if (body.customer.email) lines.push(`• البريد: ${esc(body.customer.email)}`);
    if (body.customer.business) lines.push(`• النشاط: ${esc(body.customer.business)}`);
    if (body.customer.notes) lines.push(`• ملاحظات: ${esc(body.customer.notes)}`);
    lines.push("");
    lines.push(`📦 <b>عدد الوحدات:</b> ${body.units.length}`);
    body.units.forEach((u, i) => {
      lines.push("");
      lines.push(`— <b>وحدة ${i + 1}</b> —`);
      lines.push(`📍 المبنى: ${u.buildingNumber}${u.buildingType ? ` (${esc(u.buildingType)})` : ""}`);
      lines.push(`🔢 رقم الوحدة: ${u.unitNumber}${u.unitType ? ` - ${esc(u.unitType)}` : ""}`);
      lines.push(`📐 المساحة: ${u.area} م²`);
      if (u.activity) lines.push(`🏭 النشاط: ${esc(u.activity)}`);
      lines.push(`💰 السعر السنوي: ${Number(u.price).toLocaleString("en-US")} ر.س`);
    });
    lines.push("");
    lines.push("— <b>الإجمالي</b> —");
    lines.push(`📐 إجمالي المساحات: ${totalArea.toLocaleString("en-US")} م²`);
    lines.push(`💰 إجمالي الإيجار السنوي: ${totalPrice.toLocaleString("en-US")} ر.س`);
    lines.push("");
    lines.push(`📅 ${date}`);

    const text = lines.join("\n");

    const results = await Promise.all(
      chatIds.map(async (chat_id) => {
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) console.error("Telegram error", chat_id, r.status, j);
        return { chat_id, ok: r.ok && j.ok };
      })
    );

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("telegram-notify error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
