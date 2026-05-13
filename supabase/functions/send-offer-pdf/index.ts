import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

interface Unit {
  buildingNumber: number;
  unitNumber: number;
  unitType?: string | null;
  area: number;
  activity?: string | null;
  price: number;
}

interface Payload {
  booking_id?: string;
  offer_number?: string;
  payment_plan?: "full" | "70" | "50";
  target_chat_id?: string;
  customer: {
    fullName: string;
    phone?: string;
    email?: string;
    business?: string;
    notes?: string;
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

function buildHtml(p: Payload): string {
  const totalArea = p.units.reduce((s, u) => s + (Number(u.area) || 0), 0);
  const totalPrice = p.units.reduce((s, u) => s + (Number(u.price) || 0), 0);
  const plan = p.payment_plan || "full";
  const planRatio = plan === "70" ? 0.7 : plan === "50" ? 0.5 : 1;
  const payable = Math.round(totalPrice * planRatio);
  const planLabel =
    plan === "full"
      ? "سداد 100% من قيمة الإيجار — مع تعهّدنا بخصم 15% من قيمة الإيجار يبدأ تطبيقه من السنة الإيجارية الثانية ولمدة ثلاث سنوات"
      : plan === "70"
      ? "سداد 70% من قيمة الإيجار السنوي عند توقيع العقد"
      : "سداد 50% من قيمة الإيجار السنوي (للمستأجرين بإيجار سنوي يتجاوز 150,000 ريال)";
  const buildings = Array.from(new Set(p.units.map((u) => u.buildingNumber))).sort((a, b) => a - b);
  const buildingsLabel = buildings.join("، ");
  const unitsList = p.units.map((u) => u.unitNumber).join(", ");
  const today = new Date().toLocaleDateString("ar-EG-u-nu-latn", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Riyadh",
  });
  const offerNumber = p.offer_number || (p.booking_id ? p.booking_id.slice(0, 8).toUpperCase() : String(Date.now()).slice(-10));
  const activities = Array.from(new Set(p.units.map((u) => (u.activity || "").trim()).filter(Boolean)));
  const propertyType = activities.length > 0 ? activities.join(" / ") : "—";

  const rows = p.units
    .map(
      (u) => `
      <tr>
        <td>${esc(u.unitNumber)}</td>
        <td>${esc(u.activity || "-")}</td>
        <td>${esc(u.unitType === "corner" ? "ركنية" : u.unitType === "interior" ? "داخلية" : u.unitType || "-")}</td>
        <td>${fmtNum(u.area)}</td>
        <td>${u.area ? fmtNum(Math.round((u.price || 0) / u.area)) : "-"}</td>
        <td>${fmtNum(u.price)}</td>
      </tr>`,
    )
    .join("");

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
    width: 794px;
    height: 1123px;
    padding: 14px 26px 70px;
    position: relative;
    background: #fff;
    overflow: hidden;
  }
  .top-bar {
    display: flex; justify-content: space-between; align-items: center;
    padding-bottom: 6px; border-bottom: 2px solid #c9a961;
  }
  .top-bar .logo-side img { height: 78px; object-fit: contain; }
  .offer-num-center {
    text-align: center;
    font-size: 13px;
    color: #1a3a6e;
    font-weight: 700;
    background: #f6f1e3;
    border: 1px solid #c9a961;
    padding: 6px 18px;
    border-radius: 6px;
    white-space: nowrap;
  }
  .offer-num-center strong { color: #1a3a6e; font-size: 14px; }

  .title { text-align: center; margin-top: 8px; }
  .title h1 { font-size: 22px; color: #1a3a6e; font-weight: 800; display: inline-block; padding-bottom: 2px; border-bottom: 2px solid #c9a961; }
  .title h2 { font-size: 14px; margin-top: 4px; font-weight: 700; color: #1a3a6e; }

  .salutation { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 8px; }
  .salutation .name { font-size: 13px; font-weight: 700; }
  .salutation .name span { color: #1a3a6e; }
  .salutation .date { font-size: 11px; color: #444; }
  .intro { font-size: 11px; margin-top: 3px; color: #333; line-height: 1.4; }

  table.info { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10.5px; }
  table.info td { border: 1px solid #d8d8d8; padding: 3px 8px; }
  table.info td.label { background: #1a3a6e; color: #fff; font-weight: 700; width: 28%; text-align: center; }
  table.info td.alt { background: #f6f6f6; }

  .units-wrap { margin-top: 8px; border: 1px solid #1a3a6e; }
  .units-title { background: #1a3a6e; color: #fff; text-align: center; padding: 4px; font-weight: 700; font-size: 12px; }
  table.units { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.units th { background: #1a3a6e; color: #fff; padding: 4px 3px; font-weight: 600; }
  table.units td { padding: 3px 3px; text-align: center; border-bottom: 1px solid #eee; }
  table.units tr:nth-child(even) td { background: #fafafa; }
  table.units tfoot td { background: #fff; color: #c9a961; font-weight: 800; font-size: 12px; padding: 5px 3px; border-top: 2px solid #1a3a6e; }
  table.units tfoot td.lbl { color: #1a3a6e; }

  .ready { margin-top: 8px; }
  .ready .head { background: #c9a961; color: #fff; text-align: center; padding: 4px; font-weight: 700; font-size: 11.5px; }
  .ready ul { padding: 5px 22px 4px; font-size: 10.5px; }
  .ready li { margin-bottom: 2px; }

  .sig-section { margin-top: 8px; }
  .sig-title { background: #1a3a6e; color: #fff; padding: 5px 12px; font-size: 13px; font-weight: 700; }
  .sig-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 8px; margin-top: 6px;
  }
  .sig-box {
    border: 1px solid #d8d8d8;
    border-radius: 6px;
    padding: 5px 8px 4px;
    text-align: center;
    background: #fafafa;
    height: 95px;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .sig-box .role { font-size: 11px; font-weight: 700; color: #1a3a6e; }
  .sig-box .visual {
    flex: 1;
    display: flex; align-items: center; justify-content: center;
    position: relative;
  }
  .sig-box .visual img.sig { height: 45px; object-fit: contain; }
  .sig-box .visual img.stamp { height: 55px; object-fit: contain; opacity: 0.92; }
  .sig-box .name-line {
    border-top: 1px solid #888;
    padding-top: 2px;
    font-size: 10px;
    color: #555;
  }

  .footer {
    position: absolute; bottom: 0; right: 0; left: 0;
    padding: 6px 26px 8px;
    border-top: 1px solid #c9a961;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 9.5px; color: #555;
    background: #fff;
  }
  .footer img { height: 30px; }
  .footer .meta { text-align: right; line-height: 1.5; }
</style>
</head>
<body>
  <div class="page">
    <div class="top-bar">
      <div class="logo-side"><img src="${LOGO_NUKHBAT}" alt="نخبة تسكين" /></div>
      <div class="offer-num-center">رقم العرض &nbsp;<strong>${esc(offerNumber)}</strong></div>
      <div class="logo-side"><img src="${LOGO_MAKKAH}" alt="المدينة الصناعية" /></div>
    </div>

    <div class="title">
      <h1>عرض تأجير</h1>
      <h2>مبني ${esc(buildingsLabel)}</h2>
    </div>

    <div class="salutation">
      <div class="name">السادة: <span>${esc(p.customer.fullName)}</span></div>
      <div class="date">${today}</div>
    </div>
    <div class="intro">نتقدم لكم بهذا العرض لتأجير مساحة لصالح علامتكم التجارية بالشروط والأحكام العامة التالية:</div>

    <table class="info">
      <tr><td class="label">المستثمر والمؤجر</td><td>شركة القمة الهادفة الحديثة</td></tr>
      <tr><td class="label">مدير التشغيل والتأجير</td><td class="alt">شركة نخبة تسكين العقارية</td></tr>
      <tr><td class="label">نوع العقار</td><td>${esc(propertyType)}</td></tr>
      <tr><td class="label">الوحدات</td><td class="alt">مبنى رقم ${esc(buildingsLabel)} (${esc(unitsList)})</td></tr>
      <tr><td class="label">المستأجر</td><td>${esc(p.customer.fullName)}</td></tr>
      <tr><td class="label">مدة العقد</td><td class="alt">سنوي</td></tr>
      <tr><td class="label">المساحة التأجيرية</td><td>مجموع المساحة الإيجارية &nbsp; <strong>${fmtNum(totalArea)}</strong> متر مربع</td></tr>
      <tr><td class="label">القيمة الإيجارية</td><td class="alt"><strong>${fmtNum(totalPrice)}</strong> ر.س &nbsp; غير شاملة ضريبة القيمة المضافة</td></tr>
      <tr><td class="label">نظام السداد</td><td><strong>${esc(planLabel)}</strong></td></tr>
      <tr><td class="label">المبلغ المستحق عند التوقيع</td><td class="alt"><strong>${fmtNum(payable)}</strong> ر.س &nbsp; (${plan === "full" ? "100%" : plan + "%"} من قيمة الإيجار، غير شامل ض.ق.م)</td></tr>
      <tr><td class="label">طريقة الدفع</td><td>حوالة بنكية على حسابنا ببنك الراجحي &nbsp; iban: SA0980000324608010669967</td></tr>
      <tr><td class="label">ملاحظات</td><td class="alt">نتعهد بإصدار فاتورة الكترونية عند تحويل كامل المبلغ في حسابنا البنكي</td></tr>
    </table>

    <div class="units-wrap">
      <div class="units-title">تفاصيل الوحدات التأجيرية</div>
      <table class="units">
        <thead>
          <tr>
            <th>رقم الوحدة</th><th>النشاط</th><th>نوع الوحدة</th><th>المساحة / الوحدة</th><th>سعر المتر ر.س</th><th>الإيجار السنوي ر.س</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td class="lbl">الإجمالي ${p.units.length}</td>
            <td></td><td></td>
            <td>${fmtNum(totalArea)}</td>
            <td></td>
            <td>${fmtNum(totalPrice)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="ready">
      <div class="head">جاهزية الوحدة من حيث التشطيب والخدمات</div>
      <ul>
        <li>يقوم المستأجر بالبدء بتركيب المعدات بالوحدة فور استلامها من تاريخ توقيع محضر الاستلام.</li>
        <li>يلتزم المستأجر بالتخلص ونقل المهملات والمحافظة على نظافة وسلامة الموقع طوال مدة الإيجار.</li>
        <li>سعر الإيجار ثابت لمدة 3 سنوات إيجارية.</li>
        <li>هذا العرض ساري لمدة 48 ساعة فقط من تاريخ إصداره.</li>
      </ul>
    </div>

    <div class="sig-section">
      <div class="sig-title">التوقيعات والاعتماد</div>
      <div class="sig-grid" style="grid-template-columns: 1fr 1fr;">
        <div class="sig-box">
          <div class="role">مدير التشغيل</div>
          <div class="visual"><img class="sig" src="${SIGNATURE_IMG}" alt="توقيع" /></div>
          <div class="name-line">شركة نخبة تسكين العقارية</div>
        </div>
        <div class="sig-box">
          <div class="role">المؤجر</div>
          <div class="visual"><img class="stamp" src="${STAMP_IMG}" alt="ختم" /></div>
          <div class="name-line">شركة القمة الهادفة الحديثة</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="meta">
        شركة القمة الهادفة الحديثة - رقم التسجيل الضريبي 31431941430003<br />
        الجموم - حي النقاية - العلاء الحضرمي - 25354 - الرقم الوطني: 7052147241
      </div>
      <img src="${LOGO_MAKKAH}" alt="" />
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
  // A4 in inches
  form.append("paperWidth", "8.27");
  form.append("paperHeight", "11.69");
  form.append("marginTop", "0");
  form.append("marginBottom", "0");
  form.append("marginLeft", "0");
  form.append("marginRight", "0");
  form.append("printBackground", "true");
  form.append("preferCssPageSize", "true");
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

async function sendPdfToTelegram(pdfBytes: Uint8Array, caption: string, fileName: string, targetChatId?: string): Promise<{ ok: boolean; results: any[] }> {
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
  try {
    const body = (await req.json()) as Payload;
    if (!body?.customer?.fullName || !Array.isArray(body.units) || body.units.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // جلب/إصدار رقم العرض التسلسلي
    try {
      const supaUrl = Deno.env.get("SUPABASE_URL");
      const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supaUrl && svc) {
        const admin = createClient(supaUrl, svc);
        const { data: oNum, error: oErr } = await admin.rpc("next_offer_number", {
          _booking_id: body.booking_id ?? null,
        });
        if (!oErr && oNum) body.offer_number = String(oNum);
      }
    } catch (e) {
      console.error("next_offer_number failed:", e);
    }

    const html = buildHtml(body);
    const pdfBytes = await renderPdfWithGotenberg(html);

    const totalPrice = body.units.reduce((s, u) => s + (Number(u.price) || 0), 0);
    const caption = [
      "📄 <b>عرض تأجير جديد</b>",
      body.booking_id ? `🆔 <code>${esc(body.booking_id)}</code>` : "",
      `👤 ${esc(body.customer.fullName)}${body.customer.phone ? ` — ${esc(body.customer.phone)}` : ""}`,
      `💰 الإجمالي: ${fmtNum(totalPrice)} ر.س`,
    ].filter(Boolean).join("\n");

    const offerRef = body.offer_number || body.booking_id?.slice(0, 8) || String(Date.now()).slice(-8);
    const tenantName = (body.customer.fullName || "").replace(/[\\/:*?"<>|]/g, "").trim();
    const fileName = `عرض تأجير - ${tenantName} - ${offerRef}.pdf`;
    const tg = await sendPdfToTelegram(pdfBytes, caption, fileName, body.target_chat_id);

    return new Response(
      JSON.stringify({ success: tg.ok, telegram: tg.results }),
      { status: tg.ok ? 200 : 207, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    console.error("send-offer-pdf error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
