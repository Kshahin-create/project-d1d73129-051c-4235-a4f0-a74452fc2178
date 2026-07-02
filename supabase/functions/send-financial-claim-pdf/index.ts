import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

interface Unit {
  buildingNumber: number;
  unitNumber: number;
  activity?: string | null;
  price: number;
}

interface Payload {
  booking_id?: string;
  claim_number?: string;
  payment_plan?: "full" | "70" | "50";
  target_chat_id?: string;
  customer: {
    fullName: string;
    phone?: string;
    business?: string;
    crNumber?: string;
  };
  units: Unit[];
}

const LOGO_NUKHBAT = "https://wqzseofoerwevfebguse.supabase.co/storage/v1/object/public/email-assets/logo-nukhbat-v2.png";
const LOGO_MAKKAH = "https://wqzseofoerwevfebguse.supabase.co/storage/v1/object/public/email-assets/logo-makkah-v2.png";
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
  const plan = p.payment_plan || "full";
  const planRatio = plan === "70" ? 0.7 : plan === "50" ? 0.5 : 1;
  const planLabel =
    plan === "full"
      ? "نظام سداد 100% من قيمة الإيجار"
      : plan === "70"
      ? "نظام سداد 70% من قيمة الإيجار"
      : "نظام سداد 50% من قيمة الإيجار";
  const payable = Math.round(annual * planRatio);
  const vat = Math.round(payable * 0.15);
  const total = payable + vat;

  const buildings = Array.from(new Set(p.units.map((u) => u.buildingNumber))).sort((a, b) => a - b);
  const unitsByBuilding = buildings.map((b) => {
    const nums = p.units.filter((u) => u.buildingNumber === b).map((u) => u.unitNumber).join("، ");
    return `مبنى ${b} وحدة رقم (${nums})`;
  }).join(" — ");

  const activities = Array.from(new Set(p.units.map((u) => (u.activity || "").trim()).filter(Boolean)));
  const activityLabel = activities.length > 0 ? activities.join(" / ") : "—";

  const pledgeHtml =
    plan === "full"
      ? `نتعهد بتطبيق خصم نقدي 15% لكل سنة إيجارية ولمدة ثلاث سنوات يبدأ تطبيقه من السنة الإيجارية الثانية، وذلك عند سداد كامل قيمة الإيجار 100% للسنة الأولى.`
      : plan === "70"
      ? `تم اختيار نظام السداد بنسبة 70% من قيمة الإيجار السنوي عند توقيع العقد.`
      : `تم اختيار نظام السداد بنسبة 50% من قيمة الإيجار السنوي (متاح للمستأجرين بإيجار سنوي يتجاوز 150,000 ريال).`;

  const amountsRows = plan === "full"
    ? `
        <tr><td>قيمة الإيجار السنوي للوحدات (100%)</td><td class="amt">${fmtNum(annual)} ر.س</td></tr>
        <tr><td>ضريبة القيمة المضافة (15%)</td><td class="amt">${fmtNum(vat)} ر.س</td></tr>
        <tr class="total"><td class="lbl">الإجمالي المستحق</td><td class="amt" style="font-weight:900;font-size:18px;">${fmtNum(total)} ر.س</td></tr>`
    : `
        <tr><td>قيمة الإيجار السنوي الإجمالية</td><td class="amt">${fmtNum(annual)} ر.س</td></tr>
        <tr><td>${planLabel} (${plan}%)</td><td class="amt">${fmtNum(payable)} ر.س</td></tr>
        <tr><td>ضريبة القيمة المضافة (15%) على المبلغ المستحق</td><td class="amt">${fmtNum(vat)} ر.س</td></tr>
        <tr class="total"><td class="lbl">الإجمالي المستحق الآن</td><td class="amt" style="font-weight:900;font-size:18px;">${fmtNum(total)} ر.س</td></tr>`;

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
    width: 794px; height: 1123px;
    padding: 22px 48px 95px; position: relative; background: #fff;
    overflow: hidden;
  }

  .top-bar {
    display: flex; justify-content: space-between; align-items: center;
    padding-bottom: 8px; border-bottom: 3px solid var(--gold);
  }
  .top-bar img { height: 110px; object-fit: contain; }

  .date-block {
    margin-top: 12px;
    display: flex; justify-content: flex-start;
    font-size: 13px; color: #222;
  }
  .date-block table { border-collapse: collapse; }
  .date-block td { padding: 2px 8px; font-weight: 700; }
  .date-block td.lbl { color: #1a1a1a; }
  .date-block td.val { color: #1a1a1a; font-weight: 500; }

  .title { text-align: center; margin: 10px 0 12px; }
  .title h1 {
    font-size: 28px; color: #2a2a2a; font-weight: 900;
    display: inline-block;
  }

  /* جدول البيانات الأساسية */
  table.info { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  table.info td {
    border: 2px solid var(--gold);
    padding: 7px 12px;
    background: #fff;
  }
  table.info td.label {
    background: var(--gold);
    color: #fff;
    font-weight: 800;
    width: 30%;
    text-align: center;
    font-size: 13.5px;
  }

  /* تعهد */
  .pledge {
    margin-top: 10px;
    background: var(--gold);
    color: #fff;
    border: 2px solid var(--gold);
    padding: 10px 16px;
    font-size: 13.5px;
    line-height: 1.6;
    text-align: center;
    font-weight: 600;
  }

  /* جدول المبالغ */
  table.amounts { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13.5px; }
  table.amounts th {
    background: var(--gold); color: #fff; font-weight: 800;
    padding: 8px; border: 2px solid var(--gold); font-size: 13.5px;
  }
  table.amounts td {
    padding: 9px 14px; border: 2px solid var(--gold); background: #fff;
    text-align: center; font-size: 13.5px;
  }
  table.amounts td.amt { font-weight: 700; }
  table.amounts tr.total td.lbl {
    font-weight: 900; font-size: 16px;
  }

  /* بيانات الدفع */
  .pay-wrap { margin-top: 12px; }
  .pay-title {
    background: var(--gold); color: #fff; text-align: center;
    padding: 8px; font-size: 14px; font-weight: 800;
    border: 2px solid var(--gold);
  }
  table.pay { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.pay td {
    border: 2px solid var(--gold); padding: 7px 12px; background: #fff;
  }
  table.pay td.label {
    background: var(--gold); color: #fff; font-weight: 800;
    width: 30%; text-align: center;
  }

  .closing-title {
    text-align: center; margin-top: 14px;
    font-size: 22px; font-weight: 900; color: #2a2a2a;
  }

  .footer {
    position: absolute; bottom: 0; right: 0; left: 0;
    padding: 14px 50px 18px;
    border-top: 2px solid var(--gold);
    background: #fff;
    display: flex; justify-content: space-between; align-items: flex-end;
    gap: 22px;
  }
  .footer .left {
    flex: 1; text-align: left;
    font-size: 12px; color: #2a2a2a; line-height: 1.8; font-weight: 700;
  }
  .footer .right { flex: 0 0 auto; text-align: center; }
  .footer .right .signer {
    font-size: 14px; font-weight: 900; color: #1a1a1a; margin-bottom: 5px;
  }
  .footer .right .stamp-row {
    display: flex; align-items: center; gap: 12px; justify-content: flex-end;
  }
  .footer .right .stamp-row img.sig { height: 58px; object-fit: contain; }
  .footer .right .stamp-row img.stamp { height: 88px; object-fit: contain; }
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
      <tr><td class="label">المستأجر</td><td>${esc(p.customer.fullName)}</td></tr>
      <tr><td class="label">الرقم الوطني الموحد</td><td>${esc(p.customer.crNumber || "—")}</td></tr>
      <tr><td class="label">نوع النشاط</td><td>${esc(activityLabel)}</td></tr>
      <tr><td class="label">المشروع</td><td>المدينة الصناعية بشمال مكة</td></tr>
      <tr><td class="label">رقم المبنى والوحدة</td><td>${esc(unitsByBuilding)}</td></tr>
      <tr><td class="label">نظام السداد</td><td><strong>${esc(planLabel)}</strong></td></tr>
    </table>

    <div class="pledge">
      ${pledgeHtml}
    </div>

    <table class="amounts">
      <thead><tr><th style="width:60%;">البيان</th><th>المبلغ</th></tr></thead>
      <tbody>${amountsRows}
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

    <div class="footer">
      <div class="left">
        رقم التسجيل الضريبي 31431941430003<br />
        الجموم - حي النقاية - العلاء الحضرمي - 25354<br />
        الرقم الوطني: 7052147241
      </div>
      <div class="right">
        <div class="signer">شركة القمة الهادفة الحديثة</div>
        <div class="stamp-row">
          <img class="stamp" src="${STAMP_IMG}" alt="ختم" />
          <img class="sig" src="${SIGNATURE_IMG}" alt="توقيع" />
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function renderPdfWithGotenberg(html: string): Promise<Uint8Array> {
  const baseUrl = (Deno.env.get("GOTENBERG_URL") || "https://pdf.mnicity.com").replace(/\/+$/, "");
  const user = Deno.env.get("GOTENBERG_USER");
  const pass = Deno.env.get("GOTENBERG_PASS");

  const form = new FormData();
  form.append("files", new File([html], "index.html", { type: "text/html" }));
  form.append("paperWidth", "8.27");
  form.append("paperHeight", "11.69");
  form.append("marginTop", "0");
  form.append("marginBottom", "0");
  form.append("marginLeft", "0");
  form.append("marginRight", "0");
  form.append("printBackground", "true");
  form.append("preferCssPageSize", "true");
  form.append("singlePage", "true");
  form.append("waitDelay", "1s");

  const headers: Record<string, string> = {};
  if (user && pass) headers["Authorization"] = `Basic ${btoa(`${user}:${pass}`)}`;

  const r = await fetch(`${baseUrl}/forms/chromium/convert/html`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Gotenberg failed [${r.status}]: ${text.slice(0, 500)}`);
  }
  return new Uint8Array(await r.arrayBuffer());
}

async function sendPdfToTelegram(pdfBytes: Uint8Array, caption: string, fileName: string, targetChatId?: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const ids: string[] = [];
  if (targetChatId) {
    ids.push(targetChatId);
  } else {
    for (const k of ["TELEGRAM_CHAT_ID_1", "TELEGRAM_CHAT_ID_2", "TELEGRAM_CHAT_ID_3", "TELEGRAM_CHAT_ID_4"]) {
      const v = Deno.env.get(k)?.trim();
      if (v) ids.push(v);
    }
    if (ids.length === 0) {
      const legacy = Deno.env.get("TELEGRAM_CHAT_IDS");
      if (legacy) legacy.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean).forEach((v) => ids.push(v));
    }
  }
  if (ids.length === 0) throw new Error("No Telegram chat IDs configured");

  const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
  const results: any[] = [];
  for (const chat_id of ids) {
    let lastErr: any = null;
    let success = false;
    let lastStatus = 0;
    let lastResp: any = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const form = new FormData();
        form.append("chat_id", chat_id);
        form.append("caption", caption);
        form.append("parse_mode", "HTML");
        form.append("document", new File([pdfBlob], fileName, { type: "application/pdf" }));
        const r = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: form });
        lastStatus = r.status;
        lastResp = await r.json().catch(() => ({}));
        if (r.ok && lastResp?.ok) { success = true; break; }
        lastErr = lastResp?.description || `HTTP ${r.status}`;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
      if (attempt < 4) await new Promise((res) => setTimeout(res, 800 * attempt));
    }
    results.push({ chat_id, ok: success, status: lastStatus, response: lastResp, error: success ? undefined : lastErr });
  }
  return { ok: results.every((r) => r.ok), results };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Require an authenticated caller (user JWT or service_role).
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  {
    const bearer = authHeader.slice(7);
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (bearer !== svc) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: claims, error: cErr } = await userClient.auth.getClaims(bearer);
      if (cErr || !claims?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  }

  try {
    const body = (await req.json()) as Payload;
    if (!body?.customer?.fullName || !Array.isArray(body.units) || body.units.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = buildHtml(body);
    const pdfBytes = await renderPdfWithGotenberg(html);

    const annual = body.units.reduce((s, u) => s + (Number(u.price) || 0), 0);
    const plan = body.payment_plan || "full";
    const planRatio = plan === "70" ? 0.7 : plan === "50" ? 0.5 : 1;
    const planLabel = plan === "full" ? "100%" : plan === "70" ? "70%" : "50%";
    const payable = Math.round(annual * planRatio);
    const vat = Math.round(payable * 0.15);
    const total = payable + vat;

    const caption = [
      "🧾 <b>مطالبة مالية</b>",
      body.booking_id ? `🆔 <code>${esc(body.booking_id)}</code>` : "",
      `👤 ${esc(body.customer.business || body.customer.fullName)}`,
      `🧮 نظام السداد: ${planLabel}`,
      `💰 الإجمالي شامل الضريبة: ${fmtNum(total)} ر.س`,
      `   • الإيجار السنوي الكامل: ${fmtNum(annual)} ر.س`,
      `   • المستحق الآن (${planLabel}): ${fmtNum(payable)} ر.س`,
      `   • ض.ق.م 15%: ${fmtNum(vat)} ر.س`,
    ].filter(Boolean).join("\n");

    const tenantName = (body.customer.fullName || "").replace(/[\\/:*?"<>|]/g, "").trim() || "مستأجر";
    const refId = body.booking_id?.slice(0, 8) || String(Date.now()).slice(-8);
    const fileName = `مطالبة مالية - ${tenantName} - ${refId}.pdf`;
    const tg = await sendPdfToTelegram(pdfBytes, caption, fileName, body.target_chat_id);

    return new Response(
      JSON.stringify({ success: tg.ok, telegram: tg.results }),
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
