// Periodic Telegram cron: daily summary, expiring bookings, overdue invoices, end-of-contract alerts.
// Triggered by pg_cron via HTTP. Use ?job=daily|expiring|overdue|contracts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const TG = (token: string, m: string) => `https://api.telegram.org/bot${token}/${m}`;
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmtNum = (n: number) => Number(n || 0).toLocaleString("en-US");
const fmtDate = (d: string | Date) => new Date(d).toLocaleString("ar-EG-u-nu-latn", { timeZone: "Asia/Riyadh" });

async function broadcast(admin: any, token: string, topic: string, text: string) {
  const { data: subs } = await admin
    .from("telegram_subscribers")
    .select("chat_id,subscriptions,muted_until")
    .or(`muted_until.is.null,muted_until.lt.${new Date().toISOString()}`);
  const targets = (subs || []).filter((s: any) => (s.subscriptions || []).includes(topic));
  if (targets.length === 0) {
    for (const k of ["TELEGRAM_CHAT_ID_1","TELEGRAM_CHAT_ID_2","TELEGRAM_CHAT_ID_3","TELEGRAM_CHAT_ID_4"]) {
      const v = Deno.env.get(k)?.trim();
      if (v) targets.push({ chat_id: Number(v) });
    }
  }
  await Promise.all(targets.map((t: any) =>
    fetch(TG(token, "sendMessage"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: t.chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
    }).catch(() => {}),
  ));
  return targets.length;
}

async function jobDaily(admin: any, token: string) {
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today.getTime() - 86400000);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const [bY, bM, invAll, units, unpaidOverdue, expiringSoon] = await Promise.all([
    admin.from("bookings").select("status,total_price,created_at").gte("created_at", yesterday.toISOString()).lt("created_at", today.toISOString()),
    admin.from("bookings").select("total_price,created_at").gte("created_at", monthStart.toISOString()),
    admin.from("invoices").select("amount,paid_amount,paid,paid_at,due_date"),
    admin.from("units").select("status"),
    admin.from("invoices").select("invoice_number").eq("paid", false).lt("due_date", today.toISOString().slice(0,10)),
    admin.from("bookings").select("id").eq("status","pending").lte("expires_at", new Date(Date.now()+86400000).toISOString()),
  ]);
  const yPay = (invAll.data||[]).filter((i: any)=>i.paid_at && new Date(i.paid_at) >= yesterday && new Date(i.paid_at) < today)
    .reduce((s,i: any)=>s+Number(i.paid_amount||0),0);
  const mPay = (invAll.data||[]).filter((i: any)=>i.paid_at && new Date(i.paid_at) >= monthStart)
    .reduce((s,i: any)=>s+Number(i.paid_amount||0),0);
  const totalUnpaid = (invAll.data||[]).filter((i: any)=>!i.paid).reduce((s,i: any)=>s+(Number(i.amount)-Number(i.paid_amount||0)),0);
  const occupied = (units.data||[]).filter((u: any)=>u.status==="rented").length;
  const total = (units.data||[]).length;

  const yBookValue = (bY.data||[]).reduce((s,b: any)=>s+Number(b.total_price||0),0);
  const mBookValue = (bM.data||[]).reduce((s,b: any)=>s+Number(b.total_price||0),0);

  // Anomaly: yesterday bookings vs 7-day average
  const sevenDaysAgo = new Date(today.getTime() - 7*86400000);
  const { data: weekBk } = await admin.from("bookings").select("created_at").gte("created_at", sevenDaysAgo.toISOString()).lt("created_at", today.toISOString());
  const avg = (weekBk?.length || 0) / 7;
  const anomaly = avg > 0 && (bY.data?.length || 0) > avg * 2 ? "📈 ارتفاع غير معتاد في الحجوزات أمس" :
                  avg > 0 && (bY.data?.length || 0) < avg * 0.3 ? "📉 انخفاض ملحوظ في الحجوزات أمس" : null;

  const lines = [
    "☀️ <b>الملخص اليومي</b>",
    `📅 ${fmtDate(today)}`,
    "",
    "<b>أمس:</b>",
    `• حجوزات: <b>${bY.data?.length||0}</b> بقيمة <b>${fmtNum(yBookValue)}</b> ر.س`,
    `• مدفوعات: <b>${fmtNum(yPay)}</b> ر.س`,
    "",
    "<b>هذا الشهر:</b>",
    `• حجوزات: <b>${bM.data?.length||0}</b> بقيمة <b>${fmtNum(mBookValue)}</b> ر.س`,
    `• مدفوعات: <b>${fmtNum(mPay)}</b> ر.س`,
    "",
    `🏢 الإشغال: <b>${occupied}/${total}</b> (${total ? Math.round(occupied/total*100):0}%)`,
    `📑 إجمالي مستحقات: <b>${fmtNum(totalUnpaid)}</b> ر.س`,
    `⚠️ فواتير متأخرة: <b>${unpaidOverdue.data?.length||0}</b>`,
    `⏰ حجوزات تنتهي خلال 24 ساعة: <b>${expiringSoon.data?.length||0}</b>`,
  ];
  if (anomaly) lines.push("", `🔍 ${anomaly}`);
  await broadcast(admin, token, "daily_summary", lines.join("\n"));
}

async function jobExpiring(admin: any, token: string) {
  const horizon = new Date(Date.now() + 2*3600*1000).toISOString();
  const { data } = await admin.from("bookings")
    .select("id,customer_full_name,expires_at,total_price,offer_number")
    .eq("status","pending")
    .lte("expires_at", horizon)
    .gte("expires_at", new Date().toISOString());
  if (!data?.length) return;
  for (const b of data) {
    const text = [
      `⏰ <b>حجز قارب على الانتهاء</b>`,
      `📄 ${esc(b.offer_number || b.id.slice(0,8))}`,
      `👤 ${esc(b.customer_full_name)}`,
      `💰 ${fmtNum(b.total_price)} ر.س`,
      `🕐 ينتهي: ${fmtDate(b.expires_at)}`,
    ].join("\n");
    await broadcast(admin, token, "expiry", text);
  }
}

async function jobOverdue(admin: any, token: string) {
  const today = new Date().toISOString().slice(0,10);
  const { data } = await admin.from("invoices")
    .select("invoice_number,customer_name,amount,paid_amount,due_date")
    .eq("paid", false).lt("due_date", today).order("due_date");
  if (!data?.length) return;
  const lines = ["⚠️ <b>فواتير متأخرة</b>\n"];
  for (const i of data.slice(0,30)) {
    const r = Number(i.amount) - Number(i.paid_amount || 0);
    lines.push(`• <b>${esc(i.invoice_number)}</b> — ${esc(i.customer_name||"—")} — <b>${fmtNum(r)}</b> — ${i.due_date}`);
  }
  await broadcast(admin, token, "overdue", lines.join("\n"));
}

async function jobContracts(admin: any, token: string) {
  // Tenants whose end_date is within 30 days
  const today = new Date();
  const horizon = new Date(today.getTime() + 30*86400000).toISOString().slice(0,10);
  const { data } = await admin.from("tenants")
    .select("tenant_name,business_name,end_date")
    .not("end_date", "is", null)
    .lte("end_date", horizon)
    .gte("end_date", today.toISOString().slice(0,10))
    .order("end_date");
  if (!data?.length) return;
  const lines = ["📜 <b>عقود قاربت على الانتهاء</b>\n"];
  for (const t of data) lines.push(`• ${esc(t.tenant_name)} — ${esc(t.business_name||"—")} — ${t.end_date}`);
  await broadcast(admin, token, "expiry", lines.join("\n"));
}

Deno.serve(async (req) => {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return new Response("no token", { status: 500 });
  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supaUrl, svc);

  const url = new URL(req.url);
  const job = url.searchParams.get("job") || "daily";
  try {
    if (job === "daily") await jobDaily(admin, token);
    else if (job === "expiring") await jobExpiring(admin, token);
    else if (job === "overdue") await jobOverdue(admin, token);
    else if (job === "contracts") await jobContracts(admin, token);
    else return new Response("unknown job", { status: 400 });
    return new Response(JSON.stringify({ ok: true, job }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error(job, e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
