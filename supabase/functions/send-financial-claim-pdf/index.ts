import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface Unit {
  buildingNumber: number;
  unitNumber: number;
  activity?: string | null;
  price: number;
}

interface Payload {
  booking_id?: string;
  claim_number?: string;
  customer: {
    fullName: string;
    phone?: string;
    business?: string;
  };
  units: Unit[];
}

const LOGO_NUKHBAT = "https://wqzseofoerwevfebguse.supabase.co/storage/v1/object/public/email-assets/offer-logo-nukhbat-transparent.png";
const LOGO_MAKKAH = "https://wqzseofoerwevfebguse.supabase.co/storage/v1/object/public/email-assets/offer-logo-makkah-transparent.png";
const STAMP_IMG = "https://wqzseofoerwevfebguse.supabase.co/storage/v1/object/public/email-assets/offer-stamp.png";

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmtNum = (n: number) => Number(n || 0).toLocaleString("en-US");

// تاريخ هجري بصيغة yyyy/mm/dd
function hijriDate(): string {
  try {
    const parts = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
      year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Riyadh",
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    return `${get("year")}/${get("month")}/${get("day")} هـ`;
  } catch {
    return "";
  }
}

function gregDate(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Riyadh",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}/${get("month")}/${get("day")} م`;
}

function buildHtml(p: Payload): string {
  const annual = p.units.reduce((s, u) => s + (Number(u.price) || 0), 0);
  const vat = Math.round(annual * 0.15);
  const total = annual + vat;

  const buildings = Array.from(new Set(p.units.map((u) => u.buildingNumber))).sort((a, b) => a - b);
  const unitsByBuilding = buildings.map((b) => {
    const nums = p.units.filter((u) => u.buildingNumber === b).map((u) => u.unitNumber).join("، ");
    return `مبنى ${b} وحدة رقم (${nums})`;
  }).join(" — ");

  const activities = Array.from(new Set(p.units.map((u) => (u.activity || "").trim()).filter(Boolean)));
  const activityLabel = activities.length > 0 ? activities.join(" / ") : "—";

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { font-family: 'Tajawal', sans-serif; color: #1a1a1a; background: #fff; }
  .page {
    width: 794px; min-height: 1123px;
    padding: 28px 40px 100px; position: relative; background: #fff;
  }
  .top-bar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 14px; border-bottom: 2px solid #c9a961; }
  .top-bar img { height: 78px; object-fit: contain; }

  .date-block { text-align: left; margin-top: 14px; font-size: 12.5px; color: #444; line-height: 1.7; }
  .date-block strong { color: #1a3a6e; }

  .title { text-align: center; margin-top: 14px; }
  .title h1 { font-size: 30px; color: #1a3a6e; font-weight: 800; display: inline-block; padding-bottom: 4px; border-bottom: 3px solid #c9a961; }

  table.info { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 13px; }
  table.info td { border: 1px solid #d8d8d8; padding: 8px 12px; }
  table.info td.label { background: #1a3a6e; color: #fff; font-weight: 700; width: 32%; text-align: center; }
  table.info td.alt { background: #f6f6f6; }

  .pledge { margin-top: 14px; background: #f6f1e3; border: 1px solid #c9a961; border-radius: 6px; padding: 10px 14px; font-size: 12.5px; color: #333; line-height: 1.7; text-align: center; }

  table.amounts { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13.5px; }
  table.amounts th { background: #1a3a6e; color: #fff; padding: 9px; font-weight: 700; }
  table.amounts td { padding: 9px 12px; border: 1px solid #ddd; }
  table.amounts td.lbl { background: #fafafa; font-weight: 600; width: 60%; }
  table.amounts tr.total td { background: #c9a961; color: #fff; font-weight: 800; font-size: 15px; }

  .pay-title { margin-top: 18px; background: #1a3a6e; color: #fff; padding: 8px 14px; font-size: 14px; font-weight: 700; }
  table.pay { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.pay td { border: 1px solid #d8d8d8; padding: 8px 12px; }
  table.pay td.label { background: #f6f6f6; font-weight: 700; width: 32%; }

  .closing { margin-top: 28px; font-size: 13px; line-height: 1.9; }
  .closing .greet { color: #555; }
  .closing .signer { margin-top: 4px; font-weight: 700; color: #1a3a6e; font-size: 14px; }
  .stamp-wrap { margin-top: 6px; }
  .stamp-wrap img { height: 95px; object-fit: contain; opacity: 0.95; }

  .footer {
    position: absolute; bottom: 0; right: 0; left: 0;
    padding: 10px 32px 12px; border-top: 1px solid #c9a961;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 10.5px; color: #555; background: #fff;
  }
  .footer img { height: 42px; }
  .footer .meta { text-align: left; line-height: 1.6; }
</style>
</head>
<body>
  <div class="page">
    <div class="top-bar">
      <img src="${LOGO_NUKHBAT}" alt="نخبة تسكين" />
      <img src="${LOGO_MAKKAH}" alt="المدينة الصناعية" />
    </div>

    <div class="date-block">
      <div><strong>التاريخ :</strong> ${esc(hijriDate())}</div>
      <div><strong>الموافق :</strong> ${esc(gregDate())}</div>
    </div>

    <div class="title"><h1>مطالبة مالية</h1></div>

    <table class="info">
      <tr><td class="label">المستأجر</td><td>${esc(p.customer.business || p.customer.fullName)}</td></tr>
      <tr><td class="label">نوع النشاط</td><td class="alt">${esc(activityLabel)}</td></tr>
      <tr><td class="label">المشروع</td><td>المدينة الصناعية بشمال مكة</td></tr>
      <tr><td class="label">رقم المبنى و الوحدة</td><td class="alt">${esc(unitsByBuilding)}</td></tr>
    </table>

    <div class="pledge">
      نتعهد بتطبيق خصم نقدي 15% لكل سنة إيجارية ولمدة ثلاث سنوات عند تحويل كامل قيمة الإيجار 100% للسنة الأولى
    </div>

    <table class="amounts">
      <thead><tr><th>البيان</th><th>المبلغ</th></tr></thead>
      <tbody>
        <tr><td class="lbl">قيمة الإيجار السنوي للوحدات</td><td>${fmtNum(annual)} ر.س</td></tr>
        <tr><td class="lbl">ضريبة القيمة المضافة (15%)</td><td>${fmtNum(vat)} ر.س</td></tr>
        <tr class="total"><td class="lbl" style="background:#c9a961;color:#fff;">الإجمالي</td><td>${fmtNum(total)} ر.س</td></tr>
      </tbody>
    </table>

    <div class="pay-title">بيانات الدفع</div>
    <table class="pay">
      <tr><td class="label">اسم البنك</td><td>مصرف الراجحي</td></tr>
      <tr><td class="label">اسم المستفيد</td><td>شركة القمة الهادفة الحديثة</td></tr>
      <tr><td class="label">رقم الـ IBAN</td><td>SA0980000324608010669967</td></tr>
    </table>

    <div class="closing">
      <div class="greet">مع أطيب التحيات ،،،</div>
      <div class="signer">شركة القمة الهادفة الحديثة</div>
      <div class="stamp-wrap"><img src="${STAMP_IMG}" alt="ختم" /></div>
    </div>

    <div class="footer">
      <img src="${LOGO_MAKKAH}" alt="" />
      <div class="meta">
        شركة القمة الهادفة الحديثة - رقم التسجيل الضريبي 31431941430003<br />
        الجموم - حي النقاية - العلاء الحضرمي - 25354 - الرقم الوطني: 7052147241
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function renderImage(html: string): Promise<string> {
  const userId = Deno.env.get("HCTI_USER_ID");
  const apiKey = Deno.env.get("HCTI_API_KEY");
  if (!userId || !apiKey) throw new Error("HCTI credentials not configured");
  const auth = btoa(`${userId}:${apiKey}`);
  const r = await fetch("https://hcti.io/v1/image", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      html,
      google_fonts: "Tajawal",
      viewport_width: 794,
      viewport_height: 1123,
      device_scale_factor: 2,
      ms_delay: 800,
    }),
  });
  const j = await r.json();
  if (!r.ok || !j?.url) throw new Error(`HCTI failed: ${JSON.stringify(j)}`);
  return j.url as string;
}

function toPdfUrl(imageUrl: string): string {
  const m = imageUrl.match(/\/v1\/image\/([^./?]+)/i);
  if (m && m[1]) return `https://hcti.io/v1/image/${m[1]}.pdf`;
  return imageUrl.replace(/\.(jpe?g|png|webp)(\?.*)?$/i, ".pdf$2");
}

async function sendPdfToTelegram(pdfUrl: string, caption: string, fileName: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const ids: string[] = [];
  for (const k of ["TELEGRAM_CHAT_ID_1", "TELEGRAM_CHAT_ID_2", "TELEGRAM_CHAT_ID_3"]) {
    const v = Deno.env.get(k)?.trim();
    if (v) ids.push(v);
  }
  if (ids.length === 0) {
    const legacy = Deno.env.get("TELEGRAM_CHAT_IDS");
    if (legacy) legacy.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean).forEach((v) => ids.push(v));
  }
  if (ids.length === 0) throw new Error("No Telegram chat IDs configured");

  const hctiUser = Deno.env.get("HCTI_USER_ID");
  const hctiKey = Deno.env.get("HCTI_API_KEY");
  const pdfRes = await fetch(pdfUrl, {
    headers: hctiUser && hctiKey ? { Authorization: `Basic ${btoa(`${hctiUser}:${hctiKey}`)}` } : {},
  });
  if (!pdfRes.ok) {
    const t = await pdfRes.text().catch(() => "");
    throw new Error(`Failed to fetch PDF: ${pdfRes.status} ${t.slice(0, 200)}`);
  }
  const pdfBlob = await pdfRes.blob();

  const results: any[] = [];
  for (const chat_id of ids) {
    const form = new FormData();
    form.append("chat_id", chat_id);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("document", new File([pdfBlob], fileName, { type: "application/pdf" }));
    const r = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: form });
    const j = await r.json().catch(() => ({}));
    results.push({ chat_id, ok: r.ok && j?.ok, status: r.status, response: j });
  }
  return { ok: results.every((r) => r.ok), results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as Payload;
    if (!body?.customer?.fullName || !Array.isArray(body.units) || body.units.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = buildHtml(body);
    const imageUrl = await renderImage(html);
    const pdfUrl = toPdfUrl(imageUrl);

    const annual = body.units.reduce((s, u) => s + (Number(u.price) || 0), 0);
    const vat = Math.round(annual * 0.15);
    const total = annual + vat;

    const caption = [
      "🧾 <b>مطالبة مالية</b>",
      body.booking_id ? `🆔 <code>${esc(body.booking_id)}</code>` : "",
      `👤 ${esc(body.customer.business || body.customer.fullName)}`,
      `💰 الإجمالي شامل الضريبة: ${fmtNum(total)} ر.س`,
      `   • الإيجار: ${fmtNum(annual)} ر.س`,
      `   • ض.ق.م 15%: ${fmtNum(vat)} ر.س`,
    ].filter(Boolean).join("\n");

    const fileName = `claim-${body.claim_number || body.booking_id || Date.now()}.pdf`;
    const tg = await sendPdfToTelegram(pdfUrl, caption, fileName);

    return new Response(
      JSON.stringify({ success: tg.ok, pdf_url: pdfUrl, image_url: imageUrl, telegram: tg.results }),
      { status: tg.ok ? 200 : 207, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("send-financial-claim-pdf error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
