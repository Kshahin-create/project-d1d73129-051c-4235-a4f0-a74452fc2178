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
const SIGNATURE_IMG = "https://wqzseofoerwevfebguse.supabase.co/storage/v1/object/public/email-assets/offer-signature.png";
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
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { font-family: 'Tajawal', sans-serif; color: #1a1a1a; background: #fff; }

  :root {
    --gold: #c9a961;
    --gold-dark: #b08d3f;
    --ink: #1f1f1f;
  }

  .page {
    width: 794px; min-height: 1123px;
    padding: 36px 56px 110px; position: relative; background: #fff;
  }

  .top-bar {
    display: flex; justify-content: space-between; align-items: center;
    padding-bottom: 14px; border-bottom: 3px solid var(--gold);
  }
  .top-bar img { height: 145px; object-fit: contain; }

  .date-block {
    margin-top: 22px;
    display: flex; justify-content: flex-start;
    font-size: 14px; color: #222;
  }
  .date-block table { border-collapse: collapse; }
  .date-block td { padding: 3px 8px; font-weight: 700; }
  .date-block td.lbl { color: #1a1a1a; }
  .date-block td.val { color: #1a1a1a; font-weight: 500; }

  .title { text-align: center; margin: 18px 0 22px; }
  .title h1 {
    font-size: 38px; color: #2a2a2a; font-weight: 900;
    display: inline-block;
  }

  /* جدول البيانات الأساسية */
  table.info { width: 100%; border-collapse: collapse; font-size: 16px; }
  table.info td {
    border: 2px solid var(--gold);
    padding: 11px 14px;
    background: #fff;
  }
  table.info td.label {
    background: var(--gold);
    color: #fff;
    font-weight: 800;
    width: 30%;
    text-align: center;
    font-size: 16px;
  }

  /* تعهد */
  .pledge {
    margin-top: 10px;
    background: var(--gold);
    color: #fff;
    border: 2px solid var(--gold);
    padding: 14px 18px;
    font-size: 16px;
    line-height: 1.9;
    text-align: center;
    font-weight: 600;
  }

  /* جدول المبالغ */
  table.amounts { width: 100%; border-collapse: collapse; margin-top: 26px; font-size: 16px; }
  table.amounts th {
    background: var(--gold); color: #fff; font-weight: 800;
    padding: 10px; border: 2px solid var(--gold); font-size: 16px;
  }
  table.amounts td {
    padding: 16px 18px; border: 2px solid var(--gold); background: #fff;
    text-align: center; font-size: 16px;
  }
  table.amounts td.amt { font-weight: 700; }
  table.amounts tr.total td.lbl {
    font-weight: 900; font-size: 20px;
  }

  /* بيانات الدفع */
  .pay-wrap { margin-top: 30px; }
  .pay-title {
    background: var(--gold); color: #fff; text-align: center;
    padding: 11px; font-size: 18px; font-weight: 800;
    border: 2px solid var(--gold);
  }
  table.pay { width: 100%; border-collapse: collapse; font-size: 15px; }
  table.pay td {
    border: 2px solid var(--gold); padding: 11px 14px; background: #fff;
  }
  table.pay td.label {
    background: var(--gold); color: #fff; font-weight: 800;
    width: 30%; text-align: center;
  }

  .closing-title {
    text-align: center; margin-top: 34px;
    font-size: 28px; font-weight: 900; color: #2a2a2a;
  }

  .footer {
    position: absolute; bottom: 0; right: 0; left: 0;
    padding: 18px 56px 22px;
    border-top: 2px solid var(--gold);
    background: #fff;
    display: flex; justify-content: space-between; align-items: flex-end;
    gap: 24px;
  }
  .footer .left { flex: 0 0 auto; text-align: left; }
  .footer .left .stamp-row {
    display: flex; align-items: center; gap: 14px; justify-content: flex-start;
  }
  .footer .left .stamp-row img.sig { height: 70px; object-fit: contain; }
  .footer .left .stamp-row img.stamp { height: 105px; object-fit: contain; }
  .footer .right {
    flex: 1; text-align: right;
    font-size: 12.5px; color: #2a2a2a; line-height: 1.9; font-weight: 700;
  }
  .footer .right .signer {
    font-size: 16px; font-weight: 900; color: #1a1a1a; margin-bottom: 6px;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="top-bar">
      <img src="${LOGO_MAKKAH}" alt="المدينة الصناعية" />
      <img src="${LOGO_NUKHBAT}" alt="نخبة تسكين" />
    </div>

    <div class="date-block">
      <table>
        <tr><td class="lbl">التاريخ :</td><td class="val">${esc(hijriDate())}</td></tr>
        <tr><td class="lbl">الموافق :</td><td class="val">${esc(gregDate())}</td></tr>
      </table>
    </div>

    <div class="title"><h1>مطالبة مالية</h1></div>

    <table class="info">
      <tr><td class="label">المستأجر</td><td>${esc(p.customer.business || p.customer.fullName)}</td></tr>
      <tr><td class="label">نوع النشاط</td><td>${esc(activityLabel)}</td></tr>
      <tr><td class="label">المشروع</td><td>المدينة الصناعية بشمال مكة</td></tr>
      <tr><td class="label">رقم المبنى والوحدة</td><td>${esc(unitsByBuilding)}</td></tr>
    </table>

    <div class="pledge">
      نتعهد بتطبيق خصم نقدي 15% لكل سنة إيجارية ولمدة ثلاث سنوات عند تحويل كامل قيمة الإيجار 100% للسنة الأولى
    </div>

    <table class="amounts">
      <thead><tr><th style="width:60%;">البيان</th><th>المبلغ</th></tr></thead>
      <tbody>
        <tr><td>قيمة الإيجار السنوي للوحدات</td><td class="amt">${fmtNum(annual)} ر.س</td></tr>
        <tr><td>ضريبة القيمة المضافة (15%)</td><td class="amt">${fmtNum(vat)} ر.س</td></tr>
        <tr class="total"><td class="lbl">الإجمالي</td><td class="amt" style="font-weight:900;font-size:18px;">${fmtNum(total)} ر.س</td></tr>
      </tbody>
    </table>

    <div class="pay-wrap">
      <div class="pay-title">بيانات الدفع</div>
      <table class="pay">
        <tr><td class="label">اسم البنك</td><td>مصرف الراجحي</td></tr>
        <tr><td class="label">اسم المستفيد</td><td>شركة القمة الهادفة الحديثة</td></tr>
        <tr><td class="label">رقم الـ IBAN</td><td>SA0980000324608010669967</td></tr>
      </table>
    </div>

    <div class="closing-title">مع أطيب التحيات ،،،</div>

    <div class="signer">شركة القمة الهادفة الحديثة</div>
    <div class="sig-row">
      <div class="stamp"><img src="${STAMP_IMG}" alt="ختم" /></div>
      <div class="sig"><img src="${SIGNATURE_IMG}" alt="توقيع" /></div>
    </div>

    <div class="footer">
      شركة القمة الهادفة الحديثة - رقم التسجيل الضريبي 31431941430003<br />
      الجموم - حي النقاية - العلاء الحضرمي - 25354 الرقم الوطني: 7052147241
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

async function imageUrlToPdfBytes(imageUrl: string): Promise<Uint8Array> {
  const { PDFDocument } = await import("https://esm.sh/pdf-lib@1.17.1");
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch HCTI image: ${imgRes.status}`);
  const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
  const ct = (imgRes.headers.get("content-type") || "").toLowerCase();
  const pdfDoc = await PDFDocument.create();
  const img = ct.includes("png") ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
  const A4_W = 595.28, A4_H = 841.89;
  const page = pdfDoc.addPage([A4_W, A4_H]);
  const ratio = Math.min(A4_W / img.width, A4_H / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  page.drawImage(img, { x: (A4_W - w) / 2, y: (A4_H - h) / 2, width: w, height: h });
  return await pdfDoc.save();
}

async function sendPdfToTelegram(pdfBytes: Uint8Array, caption: string, fileName: string) {
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

  const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
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
    const pdfBytes = await imageUrlToPdfBytes(imageUrl);

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

    const claimRef = body.claim_number || body.booking_id?.slice(0, 8) || String(Date.now()).slice(-8);
    const tenantName = (body.customer.business || body.customer.fullName || "").replace(/[\\/:*?"<>|]/g, "").trim();
    const fileName = `مطالبة مالية - ${tenantName} - ${claimRef}.pdf`;
    const tg = await sendPdfToTelegram(pdfBytes, caption, fileName);

    return new Response(
      JSON.stringify({ success: tg.ok, image_url: imageUrl, telegram: tg.results }),
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
