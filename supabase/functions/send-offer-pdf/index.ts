import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

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
  customer: {
    fullName: string;
    phone?: string;
    email?: string;
    business?: string;
    notes?: string;
  };
  units: Unit[];
}

const LOGO_NUKHBAT = "https://wqzseofoerwevfebguse.supabase.co/storage/v1/object/public/email-assets/offer-logo-nukhbat.jpeg";
const LOGO_MAKKAH = "https://wqzseofoerwevfebguse.supabase.co/storage/v1/object/public/email-assets/offer-logo-makkah.jpeg";

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmtNum = (n: number) => Number(n || 0).toLocaleString("en-US");

function buildHtml(p: Payload): string {
  const totalArea = p.units.reduce((s, u) => s + (Number(u.area) || 0), 0);
  const totalPrice = p.units.reduce((s, u) => s + (Number(u.price) || 0), 0);
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
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: 'Tajawal', sans-serif; color: #1a1a1a; background: #fff; }
  .page {
    width: 794px;
    min-height: 1123px;
    padding: 28px 36px 24px;
    position: relative;
    background: #fff;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2px solid #c9a961; }
  .offer-num { font-size: 13px; background: #f3f3f3; padding: 6px 14px; border-radius: 4px; }
  .offer-num strong { color: #1a3a6e; }
  .logos { display: flex; justify-content: space-between; align-items: center; margin-top: 18px; }
  .logos img { height: 78px; object-fit: contain; }
  .title { text-align: center; margin-top: 28px; }
  .title h1 { font-size: 36px; color: #1a3a6e; font-weight: 700; display: inline-block; padding-bottom: 6px; border-bottom: 3px solid #c9a961; }
  .title h2 { font-size: 22px; margin-top: 14px; font-weight: 700; color: #1a3a6e; }
  .salutation { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 26px; }
  .salutation .name { font-size: 18px; font-weight: 700; }
  .salutation .name span { color: #1a3a6e; }
  .salutation .date { font-size: 13px; color: #444; }
  .intro { font-size: 13px; margin-top: 8px; color: #333; }

  table.info { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
  table.info td { border: 1px solid #d8d8d8; padding: 8px 12px; }
  table.info td.label { background: #1a3a6e; color: #fff; font-weight: 700; width: 30%; text-align: center; }
  table.info td.alt { background: #f6f6f6; }

  .units-wrap { margin-top: 20px; border: 1px solid #1a3a6e; }
  .units-title { background: #1a3a6e; color: #fff; text-align: center; padding: 8px; font-weight: 700; font-size: 15px; }
  table.units { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.units th { background: #1a3a6e; color: #fff; padding: 8px 6px; font-weight: 600; }
  table.units td { padding: 7px 6px; text-align: center; border-bottom: 1px solid #eee; }
  table.units tr:nth-child(even) td { background: #fafafa; }
  table.units tfoot td { background: #fff; color: #c9a961; font-weight: 800; font-size: 16px; padding: 12px 6px; border-top: 2px solid #1a3a6e; }
  table.units tfoot td.lbl { color: #1a3a6e; }

  .ready { margin-top: 22px; }
  .ready .head { background: #c9a961; color: #fff; text-align: center; padding: 7px; font-weight: 700; font-size: 14px; }
  .ready ul { padding: 12px 28px 8px; font-size: 12.5px; }
  .ready li { margin-bottom: 5px; }

  .signature { margin-top: 26px; background: #1a3a6e; color: #fff; padding: 10px 16px; font-size: 22px; font-weight: 700; }
  .sig-rows { margin-top: 14px; font-size: 13px; }
  .sig-rows .row { display: flex; align-items: center; margin-bottom: 12px; }
  .sig-rows .dot { width: 6px; height: 6px; background: #1a3a6e; border-radius: 50%; margin-left: 8px; }
  .sig-rows .lbl { font-weight: 700; min-width: 110px; }
  .sig-rows .line { flex: 1; border-bottom: 1px solid #999; height: 18px; }

  .footer { position: absolute; bottom: 18px; right: 36px; left: 36px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #555; border-top: 1px solid #c9a961; padding-top: 8px; }
  .footer img { height: 50px; }
  .footer .meta { text-align: left; line-height: 1.7; }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div></div>
      <div class="offer-num">رقم العرض &nbsp; <strong>${esc(offerNumber)}</strong></div>
    </div>

    <div class="logos">
      <img src="${LOGO_NUKHBAT}" alt="نخبة تسكين" />
      <img src="${LOGO_MAKKAH}" alt="المدينة الصناعية بشمال مكة المكرمة" />
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
      <tr><td class="label">نوع العقار</td><td>ورش صيانة و محلات قطع غيار سيارات</td></tr>
      <tr><td class="label">الوحدات</td><td class="alt">مبنى رقم ${esc(buildingsLabel)} (${esc(unitsList)})</td></tr>
      <tr><td class="label">المستأجر</td><td>${esc(p.customer.fullName)}</td></tr>
      <tr><td class="label">مدة العقد</td><td class="alt">سنوي</td></tr>
      <tr><td class="label">المساحة التأجيرية</td><td>مجموع المساحة الإيجارية &nbsp; <strong>${fmtNum(totalArea)}</strong> متر مربع</td></tr>
      <tr><td class="label">القيمة الإيجارية</td><td class="alt"><strong>${fmtNum(totalPrice)}</strong> ر.س &nbsp; غير شاملة ضريبة القيمة المضافة</td></tr>
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
        <li>سعر الإيجار ثابت لمدة 3 سنوات إيجارية</li>
      </ul>
    </div>

    <div class="signature">التوقيع:</div>
    <div class="sig-rows">
      <div class="row"><span class="dot"></span><span class="lbl">المؤجر:</span><span class="line"></span></div>
      <div class="row"><span class="dot"></span><span class="lbl">مدير التشغيل:</span><span class="line"></span></div>
      <div class="row"><span class="dot"></span><span class="lbl">المستأجر:</span><span class="line"></span></div>
    </div>

    <div class="footer">
      <img src="${LOGO_MAKKAH}" alt="" />
      <div class="meta">
        شركة القمة الهادفة الحديثة - رقم التسجيل الضريبي 31431941430003<br />
        الجموم - حي النقاية - العلاء الحضرمي - 25354 الرقم الوطني: 7052147241
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

async function sendToTelegram(imageUrl: string, caption: string): Promise<{ ok: boolean; results: any[] }> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const ids: string[] = [];
  for (const k of ["TELEGRAM_CHAT_ID_1", "TELEGRAM_CHAT_ID_2"]) {
    const v = Deno.env.get(k)?.trim();
    if (v) ids.push(v);
  }
  if (ids.length === 0) {
    const legacy = Deno.env.get("TELEGRAM_CHAT_IDS");
    if (legacy) legacy.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean).forEach((v) => ids.push(v));
  }
  if (ids.length === 0) throw new Error("No Telegram chat IDs configured");

  const results: any[] = [];
  for (const chat_id of ids) {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, photo: imageUrl, caption, parse_mode: "HTML" }),
    });
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
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = buildHtml(body);
    const imageUrl = await renderImage(html);

    const totalPrice = body.units.reduce((s, u) => s + (Number(u.price) || 0), 0);
    const caption = [
      "📄 <b>عرض تأجير جديد</b>",
      body.booking_id ? `🆔 <code>${esc(body.booking_id)}</code>` : "",
      `👤 ${esc(body.customer.fullName)}${body.customer.phone ? ` — ${esc(body.customer.phone)}` : ""}`,
      `💰 الإجمالي: ${fmtNum(totalPrice)} ر.س`,
    ].filter(Boolean).join("\n");

    const tg = await sendToTelegram(imageUrl, caption);

    return new Response(
      JSON.stringify({ success: tg.ok, image_url: imageUrl, telegram: tg.results }),
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
