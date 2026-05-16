// Advanced Telegram bot: linking, commands, inline buttons, receipt photos, AI Q&A.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const TG = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmtNum = (n: number) => Number(n || 0).toLocaleString("en-US");
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("ar-EG-u-nu-latn", { timeZone: "Asia/Riyadh" }) : "—";

const arDigitMap: Record<string, string> = { "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9","۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9" };
const normalizeDigits = (s: unknown) => String(s ?? "").replace(/[٠-٩۰-۹]/g, (d) => arDigitMap[d] || d);
const normalizeArabic = (s: unknown) => normalizeDigits(s)
  .toLowerCase()
  .replace(/[\u064B-\u065F\u0670ـ]/g, "")
  .replace(/[إأآٱ]/g, "ا")
  .replace(/ؤ/g, "و")
  .replace(/ئ/g, "ي")
  .replace(/ى/g, "ي")
  .replace(/ة/g, "ه")
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .replace(/\s+/g, " ")
  .trim();
const digitsOnly = (s: unknown) => normalizeDigits(s).replace(/\D/g, "");
const STOP_WORDS = new Set("بيانات العميل الاسم الجوال الهاتف البريد النشاط شركة مؤسسة موسسة للتجاره التجارة قطع غيار سيارات اعملي مطلبه مطالبه مالية سداد لوحدات وحدات وحدة رقم مبنى مبني من الي على في عن هذا هذه الخاص به uuid".split(" "));
function importantTokens(s: unknown) {
  return normalizeArabic(s).split(" ").filter((w) => w.length > 1 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

function extractLine(text: string, labels: string[]) {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[:：]\\s*([^\\n]+)`, "iu");
    const m = text.match(re);
    if (m?.[1]) return m[1].replace(/👤.*$/u, "").trim();
  }
  return "";
}
function extractPhone(text: string) {
  const m = normalizeDigits(text).match(/(?:\+?966|0)?5\d{8}/);
  if (!m) return "";
  const d = digitsOnly(m[0]);
  return d.startsWith("966") ? d : d.startsWith("0") ? `966${d.slice(1)}` : `966${d}`;
}
function extractCustomerInfo(text: string) {
  return {
    fullName: extractLine(text, ["الاسم", "اسم العميل", "اسم المستأجر"]),
    phone: extractPhone(text) || extractLine(text, ["الجوال", "الهاتف", "الموبايل"]),
    email: extractLine(text, ["البريد", "الايميل", "الإيميل"]),
    business: extractLine(text, ["النشاط", "الشركة", "المؤسسة", "مؤسسة", "اسم النشاط"]),
  };
}
function extractUnitRequest(text: string) {
  const t = normalizeDigits(text);
  const building = Number((t.match(/مبن[ىي]\s*رقم?\s*(\d+)/u) || t.match(/building\s*(\d+)/i))?.[1] || 0);
  const unitNums = new Set<number>();
  const beforeBuilding = building ? t.split(/مبن[ىي]/u)[0] : t;
  const unitsSegment = (beforeBuilding.match(/(?:وحدات|الوحدات|وحده|وحدة|لوحدات)\s*(?:رقم)?\s*([\d\s,،و\-]+)/u)?.[1] || beforeBuilding);
  for (const m of unitsSegment.matchAll(/\d+/g)) {
    const n = Number(m[0]);
    if (n > 0 && n < 10000 && n !== building) unitNums.add(n);
  }
  for (const m of t.matchAll(/(?:وحده|وحدة)\s*(?:رقم)?\s*(\d+)/gu)) unitNums.add(Number(m[1]));
  return { building_number: building || undefined, unit_numbers: Array.from(unitNums) };
}
function extractPaymentPlan(text: string): "full" | "70" | "50" {
  const t = normalizeDigits(text);
  if (/70\s*%|٧٠/.test(t)) return "70";
  if (/50\s*%|٥٠/.test(t)) return "50";
  return "full";
}
function scoreRow(query: string, row: any, fields: string[]) {
  const qn = normalizeArabic(query);
  const qPhone = digitsOnly(query);
  const blob = fields.map((f) => row[f] ?? "").join(" ");
  const bn = normalizeArabic(blob);
  const bPhone = digitsOnly(blob);
  let score = 0;
  if (qPhone.length >= 8 && bPhone.includes(qPhone.slice(-9))) score += 120;
  if (qn && bn.includes(qn)) score += 90;
  for (const value of fields.map((f) => normalizeArabic(row[f] ?? "")).filter(Boolean)) {
    if (value && qn.includes(value)) score += 70;
  }
  for (const tok of importantTokens(query)) if (bn.includes(tok)) score += 12;
  return score;
}

async function tg(token: string, method: string, body: unknown) {
  return await fetch(TG(token, method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function send(token: string, chat_id: number | string, text: string, extra: Record<string, unknown> = {}) {
  return tg(token, "sendMessage", {
    chat_id, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra,
  });
}
async function answerCb(token: string, callback_query_id: string, text?: string) {
  return tg(token, "answerCallbackQuery", { callback_query_id, text, show_alert: false });
}
async function editText(token: string, chat_id: number, message_id: number, text: string) {
  return tg(token, "editMessageText", { chat_id, message_id, text, parse_mode: "HTML" });
}

function helpText() {
  return [
    "🤖 <b>أهلاً بك في بوت إدارة المدينة الصناعية</b>",
    "",
    "🔗 <b>الربط:</b> /start &lt;كود&gt; — احصل على الكود من حسابك في الموقع",
    "",
    "📊 <b>الأوامر</b>",
    "/stats — إحصائيات اليوم",
    "/unpaid — كل الفواتير غير المدفوعة",
    "/units — حالة الوحدات",
    "/booking &lt;id&gt; — تفاصيل حجز",
    "/invoice &lt;رقم&gt; — تفاصيل فاتورة",
    "/tenant &lt;اسم&gt; — بحث عن مستأجر",
    "/search &lt;كلمة&gt; — بحث في العملاء والحجوزات",
    "/expiring — حجوزات بتنتهي قريباً",
    "/overdue — فواتير متأخرة",
    "",
    "🔕 <b>الإعدادات</b>",
    "/mute &lt;ساعات&gt; — إيقاف الإشعارات مؤقتاً",
    "/unmute — تشغيل الإشعارات",
    "/subs — تفضيلات الإشعارات",
    "/sub &lt;نوع&gt; — تفعيل (booking|invoice|unit|tenant|daily_summary|expiry|overdue|anomaly)",
    "/unsub &lt;نوع&gt; — تعطيل",
    "/unlink — إلغاء ربط هذا الجهاز",
    "",
    "💬 اسأل بلغتك العادية: مثل «كم حجوزات اليوم؟» أو «إيرادات الشهر»",
    "📸 ابعت صورة إيصال — هتترفق بآخر فاتورة استعرضتها",
  ].join("\n");
}

async function getSub(admin: any, chat_id: number) {
  const { data } = await admin.from("telegram_subscribers").select("*").eq("chat_id", chat_id).maybeSingle();
  return data;
}
async function requireLinked(admin: any, token: string, chat_id: number) {
  const s = await getSub(admin, chat_id);
  if (!s?.user_id) {
    await send(token, chat_id, "🚫 لازم تربط حسابك الأول. روح للموقع → الحساب → ربط تيليجرام، واحصل على الكود ثم أرسل:\n<code>/start الكود</code>");
    return null;
  }
  return s;
}

// === Commands ===
async function cmdStats(admin: any, token: string, chat_id: number) {
  const today = new Date(); today.setHours(0,0,0,0);
  const iso = today.toISOString();
  const [bookingsRes, invoicesRes, unitsRes, unpaidRes] = await Promise.all([
    admin.from("bookings").select("id,status,total_price,paid_amount,created_at").gte("created_at", iso),
    admin.from("invoices").select("id,amount,paid_amount,paid,paid_at,created_at"),
    admin.from("units").select("status"),
    admin.from("invoices").select("amount,paid_amount").eq("paid", false),
  ]);
  const bookings = bookingsRes.data || [];
  const invoices = invoicesRes.data || [];
  const units = unitsRes.data || [];
  const unpaid = unpaidRes.data || [];

  const todayPayments = invoices.filter((i: any) => i.paid_at && new Date(i.paid_at) >= today)
    .reduce((s: number, i: any) => s + Number(i.paid_amount || 0), 0);
  const todayBookingsValue = bookings.reduce((s: number, b: any) => s + Number(b.total_price || 0), 0);
  const totalUnpaid = unpaid.reduce((s: number, i: any) => s + (Number(i.amount) - Number(i.paid_amount || 0)), 0);
  const occupied = units.filter((u: any) => u.status === "rented").length;
  const total = units.length;
  const occRate = total ? Math.round((occupied / total) * 100) : 0;

  const lines = [
    "📊 <b>إحصائيات اليوم</b>",
    `🆕 حجوزات جديدة: <b>${bookings.length}</b> بقيمة <b>${fmtNum(todayBookingsValue)}</b> ر.س`,
    `💵 مدفوعات اليوم: <b>${fmtNum(todayPayments)}</b> ر.س`,
    `📑 فواتير غير مدفوعة: <b>${unpaid.length}</b> بإجمالي <b>${fmtNum(totalUnpaid)}</b> ر.س`,
    `🏢 الإشغال: <b>${occupied}/${total}</b> (${occRate}%)`,
    "",
    `📅 ${fmtDate(new Date().toISOString())}`,
  ];
  await send(token, chat_id, lines.join("\n"));
}

async function cmdUnpaid(admin: any, token: string, chat_id: number) {
  const { data } = await admin
    .from("invoices")
    .select("id,invoice_number,amount,paid_amount,customer_name,due_date,created_at")
    .eq("paid", false)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(20);
  if (!data?.length) return send(token, chat_id, "🎉 مفيش فواتير غير مدفوعة!");
  const lines = ["📑 <b>فواتير غير مدفوعة</b> (آخر 20)\n"];
  for (const i of data) {
    const remaining = Number(i.amount) - Number(i.paid_amount || 0);
    lines.push(`• <b>${esc(i.invoice_number)}</b> — ${esc(i.customer_name || "—")} — <b>${fmtNum(remaining)}</b> ر.س${i.due_date ? ` — ⏰ ${i.due_date}` : ""}`);
  }
  await send(token, chat_id, lines.join("\n"));
}

async function cmdUnits(admin: any, token: string, chat_id: number) {
  const { data } = await admin.from("units").select("status,building_number");
  const byStatus: Record<string, number> = {};
  const byBuilding: Record<string, { rented: number; available: number; reserved: number }> = {};
  for (const u of data || []) {
    byStatus[u.status] = (byStatus[u.status] || 0) + 1;
    const b = String(u.building_number);
    byBuilding[b] = byBuilding[b] || { rented: 0, available: 0, reserved: 0 };
    (byBuilding[b] as any)[u.status] = ((byBuilding[b] as any)[u.status] || 0) + 1;
  }
  const lines = [
    "🏢 <b>حالة الوحدات</b>",
    `🟢 متاحة: <b>${byStatus.available || 0}</b>`,
    `🟡 محجوزة: <b>${byStatus.reserved || 0}</b>`,
    `🔴 مؤجّرة: <b>${byStatus.rented || 0}</b>`,
    "",
    "<b>حسب المبنى:</b>",
  ];
  for (const b of Object.keys(byBuilding).sort((a, c) => +a - +c)) {
    const x = byBuilding[b];
    lines.push(`مبنى ${b}: 🟢${x.available} 🟡${x.reserved} 🔴${x.rented}`);
  }
  await send(token, chat_id, lines.join("\n"));
}

async function cmdBooking(admin: any, token: string, chat_id: number, arg: string) {
  const m = arg.match(UUID_RE);
  if (!m) return send(token, chat_id, "اكتب الأمر مع UUID الحجز: <code>/booking &lt;id&gt;</code>");
  const id = m[0];
  const { data: b } = await admin.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!b) return send(token, chat_id, "❌ مفيش حجز بهذا الـ ID");
  const { data: u } = await admin.from("booking_units").select("*").eq("booking_id", id);
  await admin.from("telegram_subscribers").update({ last_referenced_booking_id: id }).eq("chat_id", chat_id);
  const lines = [
    `🗂️ <b>حجز ${esc(b.offer_number || b.id.slice(0,8))}</b>`,
    `📌 الحالة: <b>${esc(b.status)}</b>`,
    `👤 ${esc(b.customer_full_name)} — 📞 ${esc(b.customer_phone)}`,
    b.business_name ? `🏢 ${esc(b.business_name)}` : null,
    `📦 وحدات: ${u?.length || 0}`,
    `💰 إجمالي: <b>${fmtNum(b.total_price)}</b> — مدفوع: <b>${fmtNum(b.paid_amount)}</b>`,
    `⏰ ينتهي: ${fmtDate(b.expires_at)}`,
  ].filter(Boolean).join("\n");
  const buttons: any[] = [];
  if (b.status === "pending") {
    buttons.push([
      { text: "✅ تأكيد", callback_data: `confirm_b:${id}` },
      { text: "❌ إلغاء", callback_data: `cancel_b:${id}` },
    ]);
  }
  buttons.push([{ text: "📄 عرض/مطالبة PDF", callback_data: `pdfs_b:${id}` }]);
  await send(token, chat_id, lines, { reply_markup: { inline_keyboard: buttons } });
}

async function cmdInvoice(admin: any, token: string, chat_id: number, arg: string) {
  if (!arg) return send(token, chat_id, "اكتب: <code>/invoice INV-2026-00001</code>");
  const { data } = await admin.from("invoices").select("*").or(`invoice_number.eq.${arg},id.eq.${arg.match(UUID_RE)?.[0] ?? "00000000-0000-0000-0000-000000000000"}`).limit(1).maybeSingle();
  if (!data) return send(token, chat_id, "❌ مفيش فاتورة");
  await admin.from("telegram_subscribers").update({ last_referenced_invoice_id: data.id }).eq("chat_id", chat_id);
  const remaining = Number(data.amount) - Number(data.paid_amount || 0);
  const lines = [
    `🧾 <b>فاتورة ${esc(data.invoice_number)}</b>`,
    `👤 ${esc(data.customer_name || "—")}`,
    `💰 المبلغ: <b>${fmtNum(data.amount)}</b> — مدفوع: <b>${fmtNum(data.paid_amount)}</b> — متبقي: <b>${fmtNum(remaining)}</b>`,
    `📌 ${data.paid ? "✅ مدفوعة" : "⏳ غير مدفوعة"}`,
    data.due_date ? `⏰ الاستحقاق: ${data.due_date}` : null,
    data.receipt_image_url ? `📎 يوجد إيصال مرفق` : null,
  ].filter(Boolean).join("\n");
  const buttons: any[] = [];
  if (!data.paid) buttons.push([{ text: "✅ تسجيل دفع كامل", callback_data: `pay_full:${data.id}` }]);
  await send(token, chat_id, lines, buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {});
}

async function cmdTenant(admin: any, token: string, chat_id: number, arg: string) {
  if (!arg) return send(token, chat_id, "اكتب: <code>/tenant اسم_المستأجر</code>");
  const { data } = await admin.from("tenant_accounts").select("id,full_name,phone,business_name,total_price,paid_amount").ilike("full_name", `%${arg}%`).limit(10);
  if (!data?.length) return send(token, chat_id, "❌ مفيش نتائج");
  const lines = [`👥 <b>نتائج البحث (${data.length})</b>\n`];
  for (const t of data) {
    lines.push(`• <b>${esc(t.full_name)}</b> — ${esc(t.phone || "—")} — إجمالي ${fmtNum(t.total_price)} مدفوع ${fmtNum(t.paid_amount)}`);
  }
  await send(token, chat_id, lines.join("\n"));
}

async function cmdSearch(admin: any, token: string, chat_id: number, q: string) {
  if (!q) return send(token, chat_id, "اكتب: <code>/search كلمة</code>");
  const [bk, ta] = await Promise.all([
    admin.from("bookings").select("id,customer_full_name,customer_phone,total_price,status").or(`customer_full_name.ilike.%${q}%,customer_phone.ilike.%${q}%,business_name.ilike.%${q}%`).limit(8),
    admin.from("tenant_accounts").select("id,full_name,phone").or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`).limit(8),
  ]);
  const lines = [`🔎 <b>نتائج: ${esc(q)}</b>`];
  if (bk.data?.length) {
    lines.push("\n<b>حجوزات:</b>");
    for (const b of bk.data) lines.push(`• ${esc(b.customer_full_name)} — ${b.status} — ${fmtNum(b.total_price)} — <code>${b.id.slice(0,8)}</code>`);
  }
  if (ta.data?.length) {
    lines.push("\n<b>مستأجرين:</b>");
    for (const t of ta.data) lines.push(`• ${esc(t.full_name)} — ${esc(t.phone || "—")}`);
  }
  if (!bk.data?.length && !ta.data?.length) lines.push("❌ مفيش نتائج");
  await send(token, chat_id, lines.join("\n"));
}

async function searchTenantAccountsSmart(admin: any, query: string, limit = 10) {
  const info = extractCustomerInfo(query);
  const phone = digitsOnly(info.phone || query);
  const phrases = [info.fullName, info.business, query].map(normalizeArabic).filter(Boolean);
  const tokens = Array.from(new Set(importantTokens([info.fullName, info.business, query].join(" ")))).slice(0, 8);
  const orParts: string[] = [];
  if (phone.length >= 8) orParts.push(`phone.ilike.%${phone.slice(-9)}%`, `email.ilike.%${phone.slice(-9)}%`);
  for (const p of phrases) if (p.length >= 3 && p.length <= 80) orParts.push(`full_name.ilike.%${p}%`, `business_name.ilike.%${p}%`);
  for (const tok of tokens) orParts.push(`full_name.ilike.%${tok}%`, `business_name.ilike.%${tok}%`, `activity_type.ilike.%${tok}%`);

  const rows = new Map<string, any>();
  if (orParts.length) {
    const { data } = await admin.from("tenant_accounts")
      .select("id,user_id,full_name,phone,email,business_name,activity_type,total_price,paid_amount,cr_number")
      .or(orParts.join(","))
      .limit(50);
    for (const r of data || []) rows.set(r.id, r);
  }
  if (rows.size === 0) {
    const { data } = await admin.from("tenant_accounts")
      .select("id,user_id,full_name,phone,email,business_name,activity_type,total_price,paid_amount,cr_number")
      .order("created_at", { ascending: false }).limit(200);
    for (const r of data || []) rows.set(r.id, r);
  }
  const scored = Array.from(rows.values())
    .map((r) => ({ ...r, match_score: scoreRow(query, r, ["full_name","phone","email","business_name","activity_type","cr_number"]) }))
    .filter((r) => r.match_score > 0)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, Math.max(1, Math.min(50, Number(limit) || 10)));
  return scored;
}

async function searchBookingsSmart(admin: any, query: string, limit = 10) {
  const info = extractCustomerInfo(query);
  const phone = digitsOnly(info.phone || query);
  const tokens = Array.from(new Set(importantTokens([info.fullName, info.business, query].join(" ")))).slice(0, 8);
  const orParts: string[] = [];
  if (phone.length >= 8) orParts.push(`customer_phone.ilike.%${phone.slice(-9)}%`, `customer_email.ilike.%${phone.slice(-9)}%`);
  for (const v of [info.fullName, info.business, query].map(normalizeArabic).filter(Boolean)) {
    if (v.length >= 3 && v.length <= 80) orParts.push(`customer_full_name.ilike.%${v}%`, `business_name.ilike.%${v}%`, `customer_email.ilike.%${v}%`, `offer_number.ilike.%${v}%`);
  }
  for (const tok of tokens) orParts.push(`customer_full_name.ilike.%${tok}%`, `business_name.ilike.%${tok}%`);
  const rows = new Map<string, any>();
  if (orParts.length) {
    const { data } = await admin.from("bookings")
      .select("id,customer_full_name,customer_phone,customer_email,business_name,offer_number,status,total_price,paid_amount,payment_plan,created_at")
      .or(orParts.join(","))
      .order("created_at", { ascending: false }).limit(50);
    for (const r of data || []) rows.set(r.id, r);
  }
  const scored = Array.from(rows.values())
    .map((r) => ({ ...r, match_score: scoreRow(query, r, ["customer_full_name","customer_phone","customer_email","business_name","offer_number"]) }))
    .filter((r) => r.match_score > 0)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, Math.max(1, Math.min(50, Number(limit) || 10)));
  return scored;
}

async function generateFinancialClaimFromText(admin: any, chat_id: number, text: string, overrides: any = {}) {
  const info = extractCustomerInfo(text);
  const req = extractUnitRequest(text);
  const building = Number(overrides.building_number || req.building_number || 0);
  const unitNumbers = (Array.isArray(overrides.unit_numbers) && overrides.unit_numbers.length ? overrides.unit_numbers : req.unit_numbers).map(Number).filter(Boolean);
  const paymentPlan = (overrides.payment_plan || extractPaymentPlan(text)) as "full" | "70" | "50";
  if (!building || unitNumbers.length === 0) return { error: "محتاج رقم المبنى وأرقام الوحدات" };

  const { data: units, error: unitErr } = await admin.from("units")
    .select("id,building_number,unit_number,activity,price,status")
    .eq("building_number", building)
    .in("unit_number", unitNumbers);
  if (unitErr) return { error: unitErr.message };
  if ((units || []).length !== unitNumbers.length) {
    const found = new Set((units || []).map((u: any) => Number(u.unit_number)));
    const missing = unitNumbers.filter((n: number) => !found.has(n));
    return { error: `لم أجد الوحدات: ${missing.join("، ")} في مبنى ${building}` };
  }

  let tenant: any = null;
  if (overrides.tenant_account_id) {
    const { data } = await admin.from("tenant_accounts").select("*").eq("id", overrides.tenant_account_id).maybeSingle();
    tenant = data;
  }
  if (!tenant) {
    const tenantMatches = await searchTenantAccountsSmart(admin, text, 5);
    tenant = tenantMatches[0]?.match_score >= 35 ? tenantMatches[0] : null;
  }
  if (!tenant && !info.fullName && !info.business && !info.phone) {
    return { error: "لم أجد بيانات العميل في الرسالة" };
  }

  const customer = {
    fullName: tenant?.full_name || info.fullName || info.business || "عميل",
    phone: tenant?.phone || info.phone || undefined,
    email: tenant?.email || info.email || undefined,
    business: tenant?.business_name || info.business || undefined,
    crNumber: tenant?.cr_number || undefined,
  };
  const payload = {
    payment_plan: paymentPlan,
    target_chat_id: String(chat_id),
    customer,
    units: (units || []).sort((a: any, b: any) => Number(a.unit_number) - Number(b.unit_number)).map((u: any) => ({
      buildingNumber: Number(u.building_number), unitNumber: Number(u.unit_number),
      activity: u.activity, price: Number(u.price || 0),
    })),
  };
  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const r = await fetch(`${supaUrl}/functions/v1/send-financial-claim-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${svc}`, "apikey": svc },
    body: JSON.stringify(payload),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok && !out.success) return { error: out.error || `فشل إرسال المطالبة (HTTP ${r.status})` };
  const annual = payload.units.reduce((s: number, u: any) => s + Number(u.price || 0), 0);
  const ratio = paymentPlan === "70" ? 0.7 : paymentPlan === "50" ? 0.5 : 1;
  const payable = Math.round(annual * ratio);
  const total = payable + Math.round(payable * 0.15);
  return { ok: true, customer, building_number: building, unit_numbers: unitNumbers, payment_plan: paymentPlan, annual, total_with_vat: total, tenant_account_id: tenant?.id || null };
}

async function cmdExpiring(admin: any, token: string, chat_id: number) {
  const { data } = await admin.from("bookings")
    .select("id,customer_full_name,expires_at,total_price")
    .eq("status", "pending")
    .lte("expires_at", new Date(Date.now() + 24*3600*1000).toISOString())
    .gte("expires_at", new Date().toISOString())
    .order("expires_at");
  if (!data?.length) return send(token, chat_id, "✅ مفيش حجوزات قاربت تنتهي خلال 24 ساعة");
  const lines = ["⏰ <b>حجوزات قاربت تنتهي</b>\n"];
  for (const b of data) lines.push(`• ${esc(b.customer_full_name)} — ${fmtNum(b.total_price)} — ينتهي ${fmtDate(b.expires_at)}`);
  await send(token, chat_id, lines.join("\n"));
}

async function cmdOverdue(admin: any, token: string, chat_id: number) {
  const today = new Date().toISOString().slice(0,10);
  const { data } = await admin.from("invoices")
    .select("invoice_number,customer_name,amount,paid_amount,due_date")
    .eq("paid", false)
    .lt("due_date", today)
    .order("due_date");
  if (!data?.length) return send(token, chat_id, "✅ مفيش فواتير متأخرة");
  const lines = ["⚠️ <b>فواتير متأخرة</b>\n"];
  for (const i of data) {
    const r = Number(i.amount) - Number(i.paid_amount || 0);
    lines.push(`• <b>${esc(i.invoice_number)}</b> — ${esc(i.customer_name)} — <b>${fmtNum(r)}</b> — استحق ${i.due_date}`);
  }
  await send(token, chat_id, lines.join("\n"));
}

async function cmdMute(admin: any, token: string, chat_id: number, arg: string) {
  const hours = Math.max(1, Math.min(168, parseInt(arg) || 8));
  const until = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  await admin.from("telegram_subscribers").update({ muted_until: until }).eq("chat_id", chat_id);
  await send(token, chat_id, `🔕 الإشعارات متوقفة لمدة ${hours} ساعة (حتى ${fmtDate(until)})`);
}
async function cmdUnmute(admin: any, token: string, chat_id: number) {
  await admin.from("telegram_subscribers").update({ muted_until: null }).eq("chat_id", chat_id);
  await send(token, chat_id, "🔔 تم تشغيل الإشعارات");
}
async function cmdSubs(admin: any, token: string, chat_id: number) {
  const s = await getSub(admin, chat_id);
  await send(token, chat_id, `🛎️ تفضيلاتك: <code>${(s?.subscriptions || []).join(", ") || "—"}</code>\n${s?.muted_until ? `🔕 متوقفة حتى ${fmtDate(s.muted_until)}` : "🔔 شغّالة"}`);
}
async function setSub(admin: any, token: string, chat_id: number, arg: string, on: boolean) {
  const allowed = ["booking","invoice","unit","tenant","daily_summary","expiry","overdue","anomaly"];
  const k = arg.trim().toLowerCase();
  if (!allowed.includes(k)) return send(token, chat_id, `النوع غير صحيح. المسموح: ${allowed.join(", ")}`);
  const s = await getSub(admin, chat_id);
  const cur = new Set<string>(s?.subscriptions || []);
  if (on) cur.add(k); else cur.delete(k);
  await admin.from("telegram_subscribers").update({ subscriptions: Array.from(cur) }).eq("chat_id", chat_id);
  await send(token, chat_id, `✅ ${on ? "تم تفعيل" : "تم تعطيل"}: ${k}`);
}
async function cmdUnlink(admin: any, token: string, chat_id: number) {
  await admin.from("telegram_subscribers").delete().eq("chat_id", chat_id);
  await send(token, chat_id, "👋 تم إلغاء الربط. لإعادة الربط استخدم /start &lt;كود&gt;");
}

// === AI Q&A with tool calling ===
const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_overview",
      description: "إحصائيات شاملة: حجوزات اليوم/الشهر، مدفوعات، فواتير غير مدفوعة، إشغال الوحدات، إيرادات متوقعة.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "search_bookings",
      description: "بحث في الحجوزات بالاسم/الجوال/النشاط أو فلترة بالحالة.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "كلمة بحث (اختياري)" },
          status: { type: "string", enum: ["pending","confirmed","cancelled","expired"], description: "فلترة بالحالة (اختياري)" },
          limit: { type: "number", description: "عدد النتائج (1-20)", default: 10 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_invoices",
      description: "بحث/فلترة الفواتير: غير مدفوعة، متأخرة، باسم العميل، أو رقم الفاتورة.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "اسم عميل أو رقم فاتورة" },
          unpaid_only: { type: "boolean" },
          overdue_only: { type: "boolean" },
          limit: { type: "number", default: 10 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_tenants",
      description: "بحث في المستأجرين بالاسم أو الجوال.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "number", default: 10 } },
        required: ["query"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "units_breakdown",
      description: "تفاصيل الوحدات: حسب الحالة، حسب المبنى، أو الوحدات المتاحة فقط.",
      parameters: {
        type: "object",
        properties: {
          building_number: { type: "number" },
          status: { type: "string", enum: ["available","reserved","rented"] },
          limit: { type: "number", default: 30 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "revenue_report",
      description: "تقرير مالي بفترة زمنية (اليوم/الأسبوع/الشهر/السنة): إيرادات، مدفوعات، حجوزات.",
      parameters: {
        type: "object",
        properties: { period: { type: "string", enum: ["today","week","month","year"], default: "month" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resolve_booking_id",
      description: "ابحث عن UUID حجز عبر اسم العميل/الجوال/رقم العرض. استخدمها لو المستخدم ذكر اسم بدل ID قبل أي إجراء كتابة.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "resolve_unit_id",
      description: "ابحث عن UUID وحدة برقم المبنى ورقم الوحدة.",
      parameters: { type: "object", properties: { building_number: { type: "number" }, unit_number: { type: "string" } }, required: ["building_number","unit_number"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "confirm_booking",
      description: "تأكيد حجز معلّق وتحويل وحداته إلى مؤجّرة. يحتاج صلاحية admin/manager.",
      parameters: { type: "object", properties: { booking_id: { type: "string" }, paid_amount: { type: "number", default: 0 } }, required: ["booking_id"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_booking",
      description: "إلغاء حجز وإرجاع وحداته إلى متاحة.",
      parameters: { type: "object", properties: { booking_id: { type: "string" } }, required: ["booking_id"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "extend_booking_expiry",
      description: "تمديد فترة انتهاء حجز بعدد ساعات (موجب يمدد، سالب يقصّر).",
      parameters: { type: "object", properties: { booking_id: { type: "string" }, hours: { type: "number" } }, required: ["booking_id","hours"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "record_payment",
      description: "تسجيل دفعة على حجز أو حساب مستأجر. ينشئ فاتورة آلياً.",
      parameters: {
        type: "object",
        properties: {
          booking_id: { type: "string" },
          tenant_account_id: { type: "string" },
          amount: { type: "number" },
          method: { type: "string", enum: ["cash","bank","card","transfer"], default: "cash" },
          notes: { type: "string" },
        },
        required: ["amount"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_financial_claim",
      description: "إنشاء وإرسال مطالبة مالية PDF على تيليجرام من بيانات العميل ورقم المبنى والوحدات. استخدمها عند طلب مطالبة/مطلبة مالية.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "نص الرسالة كامل أو اسم/جوال العميل" },
          tenant_account_id: { type: "string" },
          building_number: { type: "number" },
          unit_numbers: { type: "array", items: { type: "number" } },
          payment_plan: { type: "string", enum: ["full","70","50"], default: "full" },
        },
        required: ["building_number","unit_numbers"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_booking_paid_amount",
      description: "تعديل المبلغ المدفوع لحجز (استبدال القيمة، ليس إضافة).",
      parameters: { type: "object", properties: { booking_id: { type: "string" }, paid_amount: { type: "number" } }, required: ["booking_id","paid_amount"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "set_unit_status",
      description: "تغيير حالة وحدة (متاحة/محجوزة/مؤجّرة). استخدمها بحذر.",
      parameters: { type: "object", properties: { unit_id: { type: "string" }, status: { type: "string", enum: ["available","reserved","rented"] } }, required: ["unit_id","status"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_invoice_paid",
      description: "وضع فاتورة كمدفوعة بالكامل.",
      parameters: { type: "object", properties: { invoice_id: { type: "string" } }, required: ["invoice_id"], additionalProperties: false },
    },
  },
];

// Check if linked user has admin/manager role for write operations
async function canWrite(admin: any, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data || []).map((r: any) => r.role);
  return roles.includes("admin") || roles.includes("manager");
}

async function runAITool(admin: any, name: string, args: any): Promise<any> {
  const lim = (n: any, d=10) => Math.max(1, Math.min(50, Number(n) || d));
  const today = new Date(); today.setHours(0,0,0,0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const todayStr = new Date().toISOString().slice(0,10);

  if (name === "get_overview") {
    const [b, inv, units] = await Promise.all([
      admin.from("bookings").select("status,total_price,paid_amount,created_at"),
      admin.from("invoices").select("amount,paid_amount,paid,paid_at,due_date"),
      admin.from("units").select("status,price"),
    ]);
    const B = b.data || [], I = inv.data || [], U = units.data || [];
    return {
      bookings_today: B.filter((x:any)=>new Date(x.created_at)>=today).length,
      bookings_today_value: B.filter((x:any)=>new Date(x.created_at)>=today).reduce((s:number,x:any)=>s+Number(x.total_price||0),0),
      bookings_month: B.filter((x:any)=>new Date(x.created_at)>=monthStart).length,
      bookings_month_value: B.filter((x:any)=>new Date(x.created_at)>=monthStart).reduce((s:number,x:any)=>s+Number(x.total_price||0),0),
      bookings_pending: B.filter((x:any)=>x.status==="pending").length,
      bookings_confirmed: B.filter((x:any)=>x.status==="confirmed").length,
      payments_today: I.filter((x:any)=>x.paid_at && new Date(x.paid_at)>=today).reduce((s:number,x:any)=>s+Number(x.paid_amount||0),0),
      payments_month: I.filter((x:any)=>x.paid_at && new Date(x.paid_at)>=monthStart).reduce((s:number,x:any)=>s+Number(x.paid_amount||0),0),
      unpaid_count: I.filter((x:any)=>!x.paid).length,
      unpaid_total: I.filter((x:any)=>!x.paid).reduce((s:number,x:any)=>s+(Number(x.amount)-Number(x.paid_amount||0)),0),
      overdue_count: I.filter((x:any)=>!x.paid && x.due_date && x.due_date<todayStr).length,
      units_total: U.length,
      units_rented: U.filter((u:any)=>u.status==="rented").length,
      units_reserved: U.filter((u:any)=>u.status==="reserved").length,
      units_available: U.filter((u:any)=>u.status==="available").length,
      occupancy_rate: U.length ? Math.round(U.filter((u:any)=>u.status==="rented").length/U.length*100) : 0,
      expected_annual_revenue: U.reduce((s:number,u:any)=>s+Number(u.price||0),0),
    };
  }
  if (name === "search_bookings") {
    if (args.query) return { results: await searchBookingsSmart(admin, String(args.query), lim(args.limit)) };
    let q = admin.from("bookings").select("id,customer_full_name,customer_phone,business_name,status,total_price,paid_amount,expires_at,created_at").order("created_at",{ascending:false}).limit(lim(args.limit));
    if (args.status) q = q.eq("status", args.status);
    const { data } = await q;
    return { results: data || [] };
  }
  if (name === "search_invoices") {
    let q = admin.from("invoices").select("invoice_number,customer_name,amount,paid_amount,paid,due_date,created_at").order("created_at",{ascending:false}).limit(lim(args.limit));
    if (args.unpaid_only) q = q.eq("paid", false);
    if (args.overdue_only) q = q.eq("paid", false).lt("due_date", todayStr);
    if (args.query) q = q.or(`customer_name.ilike.%${args.query}%,invoice_number.ilike.%${args.query}%`);
    const { data } = await q;
    return { results: data || [] };
  }
  if (name === "search_tenants") {
    return { results: await searchTenantAccountsSmart(admin, String(args.query || ""), lim(args.limit)) };
  }
  if (name === "units_breakdown") {
    let q = admin.from("units").select("building_number,unit_number,status,price,area,activity,unit_type").limit(lim(args.limit, 30));
    if (args.building_number) q = q.eq("building_number", args.building_number);
    if (args.status) q = q.eq("status", args.status);
    const { data } = await q;
    return { results: data || [], count: data?.length || 0 };
  }
  if (name === "revenue_report") {
    const period = args.period || "month";
    let from = new Date();
    if (period === "today") from.setHours(0,0,0,0);
    else if (period === "week") { from.setDate(from.getDate()-7); from.setHours(0,0,0,0); }
    else if (period === "month") { from.setDate(1); from.setHours(0,0,0,0); }
    else if (period === "year") { from = new Date(from.getFullYear(),0,1); }
    const fromIso = from.toISOString();
    const [bk, inv] = await Promise.all([
      admin.from("bookings").select("status,total_price,paid_amount,created_at").gte("created_at", fromIso),
      admin.from("invoices").select("amount,paid_amount,paid,paid_at").gte("paid_at", fromIso).eq("paid", true),
    ]);
    return {
      period, from: fromIso,
      bookings_count: bk.data?.length || 0,
      bookings_value: (bk.data||[]).reduce((s:number,x:any)=>s+Number(x.total_price||0),0),
      bookings_paid: (bk.data||[]).reduce((s:number,x:any)=>s+Number(x.paid_amount||0),0),
      payments_count: inv.data?.length || 0,
      payments_total: (inv.data||[]).reduce((s:number,x:any)=>s+Number(x.paid_amount||0),0),
    };
  }
  if (name === "resolve_booking_id") {
    const q = String(args.query || "").trim();
    if (!q) return { error: "query required" };
    return { results: await searchBookingsSmart(admin, q, 8) };
  }
  if (name === "resolve_unit_id") {
    const { data } = await admin.from("units").select("id,building_number,unit_number,status,price")
      .eq("building_number", args.building_number).eq("unit_number", String(args.unit_number)).limit(5);
    return { results: data || [] };
  }
  return { error: "unknown tool" };
}

async function runAIWriteTool(admin: any, userId: string, name: string, args: any, chat_id?: number): Promise<any> {
  const allowed = await canWrite(admin, userId);
  if (!allowed) return { error: "forbidden: تحتاج صلاحية admin أو manager" };

  if (name === "confirm_booking") {
    const bookingId = String(args.booking_id);
    const paid = Number(args.paid_amount || 0);
    const { data: b } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle();
    if (!b) return { error: "booking not found" };
    await admin.from("bookings").update({ status: "confirmed", paid_amount: paid, updated_at: new Date().toISOString() }).eq("id", bookingId);
    const { data: bus } = await admin.from("booking_units").select("unit_id,activity").eq("booking_id", bookingId);
    for (const bu of bus || []) {
      await admin.from("units").update({ status: "rented", updated_at: new Date().toISOString() }).eq("id", bu.unit_id);
      const { data: existing } = await admin.from("tenants").select("id").eq("unit_id", bu.unit_id).eq("booking_id", bookingId).maybeSingle();
      if (!existing) {
        await admin.from("tenants").insert({
          unit_id: bu.unit_id, tenant_name: b.customer_full_name, business_name: b.business_name,
          activity_type: bu.activity, phone: b.customer_phone, notes: b.notes,
          start_date: new Date().toISOString().slice(0,10), booking_id: bookingId,
          offer_image_url: b.offer_image_url, cr_number: b.cr_number,
        });
      }
    }
    return { ok: true, booking_id: bookingId, status: "confirmed", paid_amount: paid };
  }
  if (name === "cancel_booking") {
    const bookingId = String(args.booking_id);
    await admin.from("bookings").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", bookingId);
    const { data: bus } = await admin.from("booking_units").select("unit_id").eq("booking_id", bookingId);
    const ids = (bus || []).map((x: any) => x.unit_id);
    if (ids.length) await admin.from("units").update({ status: "available", updated_at: new Date().toISOString() }).in("id", ids).eq("status", "reserved");
    return { ok: true, booking_id: bookingId, status: "cancelled" };
  }
  if (name === "extend_booking_expiry") {
    const bookingId = String(args.booking_id);
    const hrs = Number(args.hours);
    if (!hrs) return { error: "hours required" };
    const { data: b } = await admin.from("bookings").select("expires_at,status").eq("id", bookingId).maybeSingle();
    if (!b) return { error: "booking not found" };
    const cur = b.expires_at ? new Date(b.expires_at) : new Date();
    const base = cur < new Date() ? new Date() : cur;
    const next = new Date(base.getTime() + hrs * 3600 * 1000).toISOString();
    const upd: any = { expires_at: next, updated_at: new Date().toISOString() };
    if (b.status === "expired") upd.status = "pending";
    await admin.from("bookings").update(upd).eq("id", bookingId);
    if (b.status === "expired") {
      const { data: bus } = await admin.from("booking_units").select("unit_id").eq("booking_id", bookingId);
      const ids = (bus || []).map((x: any) => x.unit_id);
      if (ids.length) await admin.from("units").update({ status: "reserved", updated_at: new Date().toISOString() }).in("id", ids).eq("status", "available");
    }
    return { ok: true, booking_id: bookingId, new_expires_at: next };
  }
  if (name === "record_payment") {
    const amt = Number(args.amount);
    if (!amt || amt <= 0) return { error: "amount must be > 0" };
    if (!args.booking_id && !args.tenant_account_id) return { error: "booking_id or tenant_account_id required" };
    const { data, error } = await admin.rpc("record_payment", {
      _booking_id: args.booking_id || null,
      _tenant_account_id: args.tenant_account_id || null,
      _amount: amt,
      _method: args.method || "cash",
      _notes: args.notes || null,
    });
    if (error) return { error: error.message };
    return { ok: true, invoice_id: data, amount: amt };
  }
  if (name === "generate_financial_claim") {
    if (!chat_id) return { error: "chat_id required" };
    return await generateFinancialClaimFromText(admin, chat_id, String(args.query || ""), args);
  }
  if (name === "set_booking_paid_amount") {
    const v = Number(args.paid_amount);
    if (v < 0) return { error: "invalid amount" };
    await admin.from("bookings").update({ paid_amount: v, updated_at: new Date().toISOString() }).eq("id", args.booking_id);
    return { ok: true, booking_id: args.booking_id, paid_amount: v };
  }
  if (name === "set_unit_status") {
    if (!["available","reserved","rented"].includes(args.status)) return { error: "invalid status" };
    await admin.from("units").update({ status: args.status, updated_at: new Date().toISOString() }).eq("id", args.unit_id);
    return { ok: true, unit_id: args.unit_id, status: args.status };
  }
  if (name === "mark_invoice_paid") {
    const { data: inv } = await admin.from("invoices").select("amount").eq("id", args.invoice_id).maybeSingle();
    if (!inv) return { error: "invoice not found" };
    await admin.from("invoices").update({
      paid_amount: inv.amount, paid: true, paid_at: new Date().toISOString(),
    }).eq("id", args.invoice_id);
    return { ok: true, invoice_id: args.invoice_id };
  }
  return { error: "unknown write tool" };
}

const WRITE_TOOLS = new Set(["confirm_booking","cancel_booking","extend_booking_expiry","record_payment","generate_financial_claim","set_booking_paid_amount","set_unit_status","mark_invoice_paid"]);
const READ_TOOLS = new Set(["get_overview","search_bookings","search_invoices","search_tenants","units_breakdown","revenue_report","resolve_booking_id","resolve_unit_id"]);

function parseInlineToolArgs(raw: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const re = /(\w+)\s*=\s*("([^"]*)"|'([^']*)'|[^,\s)]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const key = match[1];
    const value = match[3] ?? match[4] ?? match[2];
    if (/^-?\d+(\.\d+)?$/.test(value)) args[key] = Number(value);
    else if (/^(true|false)$/i.test(value)) args[key] = value.toLowerCase() === "true";
    else args[key] = value;
  }
  return args;
}

function parseInlineToolCalls(content: string): Array<{ name: string; args: Record<string, unknown> }> {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const re = /default_api\.([a-zA-Z_]\w*)\(([^()]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const name = match[1];
    if (READ_TOOLS.has(name)) calls.push({ name, args: parseInlineToolArgs(match[2]) });
  }
  return calls;
}

async function aiAnswer(admin: any, token: string, chat_id: number, question: string, userId: string | null) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return send(token, chat_id, "🤖 الذكاء الاصطناعي غير مفعّل");

  const systemPrompt = [
    "أنت مساعد ذكي لإدارة \"المدينة الصناعية شمال مكة\" (تأجير وحدات).",
    "تتكلم عربي بسيط ومختصر.",
    "عندك أدوات قراءة وأدوات كتابة (تأكيد/إلغاء/تمديد حجز، تسجيل دفعات، تعديل حالة وحدة، تعليم فاتورة مدفوعة).",
    "قبل أي أداة كتابة: لو المستخدم ذكر اسم/رقم بدل UUID، استخدم resolve_booking_id أو resolve_unit_id أولاً.",
    "ممنوع تماماً أن تطبع default_api أو print أو أسماء الأدوات للمستخدم؛ نفّذ الأدوات داخلياً ثم اعرض النتيجة النهائية فقط.",
    "نفّذ مباشرة لو الطلب واضح. لو فيه غموض (أكثر من نتيجة بحث، مبلغ غير محدد، إلخ)، اسأل سؤال توضيحي قصير قبل التنفيذ.",
    "بعد أي تعديل أكّد بالأرقام النهائية.",
    "صياغة: نقاط قصيرة، أرقام 1,234 ر.س، Bold للأرقام المهمة (HTML <b>).",
    "تاريخ اليوم: " + new Date().toLocaleDateString("ar-EG-u-nu-latn", { timeZone: "Asia/Riyadh" }),
  ].join("\n");

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
  ];

  for (let round = 0; round < 6; round++) {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages,
        tools: AI_TOOLS,
        tool_choice: "auto",
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      if (r.status === 429) return send(token, chat_id, "🤖 الذكاء الاصطناعي مزدحم، جرّب بعد دقيقة");
      if (r.status === 402) return send(token, chat_id, "🤖 رصيد الذكاء الاصطناعي خلص");
      return send(token, chat_id, `🤖 خطأ AI: ${esc(t.slice(0,200))}`);
    }
    const j = await r.json();
    const m = j?.choices?.[0]?.message;
    if (!m) return send(token, chat_id, "🤔 مفيش إجابة");

    const toolCalls = m.tool_calls || [];
    if (toolCalls.length === 0) {
      const reply = (m.content || "").trim() || "🤔 مفيش إجابة";
      const inlineCalls = parseInlineToolCalls(reply);
      if (inlineCalls.length) {
        const inlineResults = await Promise.all(inlineCalls.map(async (call) => {
          try {
            return { tool: call.name, args: call.args, result: await runAITool(admin, call.name, call.args) };
          } catch (e) {
            return { tool: call.name, args: call.args, error: String((e as Error).message) };
          }
        }));
        messages.push({ role: "assistant", content: "" });
        messages.push({
          role: "user",
          content: [
            "نفّذت الأدوات داخلياً. اكتب للمستخدم النتيجة النهائية بالعربي فقط، بدون أي كود أو أسماء أدوات.",
            JSON.stringify(inlineResults).slice(0, 12000),
          ].join("\n"),
        });
        continue;
      }
      return send(token, chat_id, `🤖 ${reply}`);
    }

    messages.push({ role: "assistant", content: m.content || "", tool_calls: toolCalls });
    const results = await Promise.all(toolCalls.map(async (tc: any) => {
      let args: any = {};
      try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
      const fname = tc.function?.name;
      try {
        const out = WRITE_TOOLS.has(fname)
          ? await runAIWriteTool(admin, userId || "", fname, args)
          : await runAITool(admin, fname, args);
        return { tool_call_id: tc.id, role: "tool", content: JSON.stringify(out).slice(0, 12000) };
      } catch (e) {
        return { tool_call_id: tc.id, role: "tool", content: JSON.stringify({ error: String((e as Error).message) }) };
      }
    }));
    messages.push(...results);
  }
  await send(token, chat_id, "🤖 مفيش إجابة نهائية بعد محاولات متعددة");
}

// === Photo (receipt) handler ===
async function handlePhoto(admin: any, token: string, chat_id: number, msg: any) {
  const sub = await getSub(admin, chat_id);
  if (!sub?.user_id) return send(token, chat_id, "🚫 ربط الحساب مطلوب");
  const invoiceId = sub.last_referenced_invoice_id;
  if (!invoiceId) return send(token, chat_id, "📎 ابعت الصورة بعد عرض فاتورة بـ /invoice");

  const photos = msg.photo as any[];
  const best = photos[photos.length - 1];
  const fr = await fetch(TG(token, "getFile") + `?file_id=${best.file_id}`);
  const fj = await fr.json();
  const filePath = fj?.result?.file_path;
  if (!filePath) return send(token, chat_id, "⚠️ تعذّر تحميل الصورة");
  const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const fileRes = await fetch(fileUrl);
  const bytes = new Uint8Array(await fileRes.arrayBuffer());
  const objectKey = `receipts/${invoiceId}/${Date.now()}.jpg`;
  const { error: upErr } = await admin.storage.from("avatars").upload(objectKey, bytes, { contentType: "image/jpeg", upsert: true });
  if (upErr) return send(token, chat_id, `⚠️ فشل الرفع: ${esc(upErr.message)}`);
  const { data: pub } = admin.storage.from("avatars").getPublicUrl(objectKey);
  await admin.from("invoices").update({ receipt_image_url: pub.publicUrl }).eq("id", invoiceId);
  await send(token, chat_id, `✅ تم إرفاق الإيصال بالفاتورة`);
}

// === Callback queries ===
async function handleCallback(admin: any, token: string, cb: any) {
  const chat_id = cb.message.chat.id;
  const message_id = cb.message.message_id;
  const data: string = cb.data || "";
  const sub = await getSub(admin, chat_id);
  if (!sub?.user_id) {
    await answerCb(token, cb.id, "🚫 ربط الحساب مطلوب");
    return;
  }
  const [action, arg] = data.split(":");
  try {
    if (action === "confirm_b") {
      await admin.rpc("confirm_booking", { _booking_id: arg, _paid_amount: 0 });
      await answerCb(token, cb.id, "✅ تم التأكيد");
      await editText(token, chat_id, message_id, `${cb.message.text}\n\n✅ <b>تم التأكيد</b>`);
    } else if (action === "cancel_b") {
      await admin.rpc("cancel_booking", { _booking_id: arg });
      await answerCb(token, cb.id, "❌ تم الإلغاء");
      await editText(token, chat_id, message_id, `${cb.message.text}\n\n❌ <b>تم الإلغاء</b>`);
    } else if (action === "pay_full") {
      const { data: inv } = await admin.from("invoices").select("amount,paid_amount").eq("id", arg).maybeSingle();
      if (!inv) throw new Error("invoice not found");
      const remaining = Number(inv.amount) - Number(inv.paid_amount || 0);
      await admin.from("invoices").update({
        paid_amount: inv.amount, paid: true, paid_at: new Date().toISOString(),
      }).eq("id", arg);
      await answerCb(token, cb.id, `✅ سُجِّل ${fmtNum(remaining)} ر.س`);
      await editText(token, chat_id, message_id, `${cb.message.text}\n\n✅ <b>تم تسجيل الدفع</b>`);
    } else if (action === "pdfs_b") {
      await answerCb(token, cb.id, "⏳ جاري الإعداد");
      await sendBookingPDFs(admin, token, chat_id, arg);
    } else {
      await answerCb(token, cb.id, "إجراء غير معروف");
    }
  } catch (e) {
    await answerCb(token, cb.id, `خطأ: ${(e as Error).message.slice(0,80)}`);
  }
}

async function sendBookingPDFs(admin: any, token: string, chat_id: number, bookingId: string) {
  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const { data: b } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (!b) return;
  const { data: u } = await admin.from("booking_units").select("*").eq("booking_id", bookingId);
  const units = (u || []).map((x: any) => ({
    buildingNumber: x.building_number, unitNumber: x.unit_number, unitType: x.unit_type,
    area: Number(x.area || 0), activity: x.activity, price: Number(x.price || 0),
  }));
  const customer = {
    fullName: b.customer_full_name, phone: b.customer_phone, email: b.customer_email,
    business: b.business_name, notes: b.notes, crNumber: b.cr_number,
  };
  const payload = { booking_id: b.id, payment_plan: b.payment_plan || "full", target_chat_id: String(chat_id), customer, units };
  const opts = { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${svc}`, "apikey": svc }, body: JSON.stringify(payload) };
  await Promise.all([
    fetch(`${supaUrl}/functions/v1/send-offer-pdf`, opts),
    fetch(`${supaUrl}/functions/v1/send-financial-claim-pdf`, opts),
  ]);
}

// === /start linking ===
async function handleStart(admin: any, token: string, chat_id: number, msg: any, arg: string) {
  if (!arg) {
    return send(token, chat_id, helpText());
  }
  const { data: tk } = await admin.from("telegram_link_tokens").select("*").eq("token", arg).maybeSingle();
  if (!tk) return send(token, chat_id, "❌ كود غير صالح");
  if (tk.used_at) return send(token, chat_id, "❌ الكود مستخدم بالفعل");
  if (new Date(tk.expires_at) < new Date()) return send(token, chat_id, "❌ الكود منتهي");
  const display = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || msg.from?.username || `chat-${chat_id}`;
  await admin.from("telegram_subscribers").upsert({
    chat_id, user_id: tk.user_id, display_name: display, is_admin: true,
  });
  await admin.from("telegram_link_tokens").update({ used_at: new Date().toISOString(), used_by_chat_id: chat_id }).eq("token", arg);
  await send(token, chat_id, `✅ تم الربط بنجاح، أهلاً ${esc(display)}!\n\n${helpText()}`);
}

// === Main handler ===
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return new Response("no bot token", { status: 500 });
  const expected = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (expected) {
    if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== expected) return new Response("unauthorized", { status: 401 });
  }
  let update: any;
  try { update = await req.json(); } catch { return new Response("ok"); }

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supaUrl, svc);

  // Callback button presses
  if (update.callback_query) {
    await handleCallback(admin, token, update.callback_query);
    return new Response("ok");
  }

  const msg = update.message ?? update.edited_message;
  if (!msg) return new Response("ok");
  const chat_id = msg.chat.id;

  // Photo upload (receipt)
  if (msg.photo) {
    await handlePhoto(admin, token, chat_id, msg);
    return new Response("ok");
  }

  const text: string = (msg.text || "").trim();
  if (!text) return new Response("ok");

  // /start linking — always allowed (no requireLinked)
  if (/^\/start(\s+|$)/.test(text)) {
    const arg = text.replace(/^\/start\s*/, "").trim();
    await handleStart(admin, token, chat_id, msg, arg);
    return new Response("ok");
  }

  // Help & legacy plain UUID lookup (allowed even before linking? require linked)
  if (/^\/help$/i.test(text)) {
    await send(token, chat_id, helpText());
    return new Response("ok");
  }

  const sub = await requireLinked(admin, token, chat_id);
  if (!sub) return new Response("ok");

  const cmdMatch = text.match(/^\/(\w+)(?:\s+(.*))?$/s);
  const cmd = cmdMatch?.[1]?.toLowerCase();
  const arg = cmdMatch?.[2]?.trim() || "";

  try {
    switch (cmd) {
      case "stats": await cmdStats(admin, token, chat_id); break;
      case "unpaid": await cmdUnpaid(admin, token, chat_id); break;
      case "units": await cmdUnits(admin, token, chat_id); break;
      case "booking": await cmdBooking(admin, token, chat_id, arg); break;
      case "invoice": await cmdInvoice(admin, token, chat_id, arg); break;
      case "tenant": await cmdTenant(admin, token, chat_id, arg); break;
      case "search": await cmdSearch(admin, token, chat_id, arg); break;
      case "expiring": await cmdExpiring(admin, token, chat_id); break;
      case "overdue": await cmdOverdue(admin, token, chat_id); break;
      case "mute": await cmdMute(admin, token, chat_id, arg); break;
      case "unmute": await cmdUnmute(admin, token, chat_id); break;
      case "subs": await cmdSubs(admin, token, chat_id); break;
      case "sub": await setSub(admin, token, chat_id, arg, true); break;
      case "unsub": await setSub(admin, token, chat_id, arg, false); break;
      case "unlink": await cmdUnlink(admin, token, chat_id); break;
      case undefined: {
        // Plain text → AI
        const m = text.match(UUID_RE);
        if (m) {
          // Legacy: send booking summary via existing logic by reusing cmdBooking
          await cmdBooking(admin, token, chat_id, m[0]);
        } else {
          await aiAnswer(admin, token, chat_id, text, sub.user_id);
        }
        break;
      }
      default:
        await send(token, chat_id, `❓ أمر غير معروف: ${esc(cmd)}\n\n${helpText()}`);
    }
  } catch (e) {
    await send(token, chat_id, `⚠️ خطأ: ${esc((e as Error).message)}`);
  }

  return new Response("ok");
});
