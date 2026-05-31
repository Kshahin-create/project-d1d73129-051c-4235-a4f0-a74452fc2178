// Sync buildings (1-10) + full system backup with Google Sheets via connector gateway
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets";
const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");

const UNIT_HEADER = [
  "رقم الوحدة","النوع","المساحة","النشاط","السعر","المدفوع","المتبقي","الحالة",
  "اسم المستأجر","الجوال","الاسم التجاري","السجل التجاري",
  "تاريخ البداية","تاريخ النهاية","ملاحظات",
];

const STATUS_AR: Record<string,string> = { available:"متاحة", reserved:"محجوزة", rented:"مؤجرة" };
const AR_STATUS: Record<string,string> = {
  "متاحة":"available","متاح":"available","شاغرة":"available","شاغر":"available",
  "محجوزة":"reserved","محجوز":"reserved",
  "مؤجرة":"rented","مؤجر":"rented","مستأجرة":"rented","مستأجر":"rented",
};
const BOOKING_STATUS_AR: Record<string,string> = {
  pending:"قيد الانتظار", confirmed:"مؤكد", cancelled:"ملغي", expired:"منتهي",
};

async function gw(path: string, init: RequestInit = {}) {
  if (!LOVABLE_API_KEY || !SHEETS_API_KEY) throw new Error("Google Sheets connector not configured");
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      ...(init.headers||{}),
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SHEETS_API_KEY,
      "Content-Type": "application/json",
    },
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${t.slice(0,400)}`);
  return t ? JSON.parse(t) : {};
}

function tabName(b: number) { return `مبنى ${b}`; }
const DASHBOARD_TAB = "الداشبورد";
const BOOKINGS_TAB = "الحجوزات";
const TENANTS_TAB = "المستأجرين";
const ACCOUNTS_TAB = "حسابات المستأجرين";
const INVOICES_TAB = "الفواتير";
const LEADS_TAB = "العملاء المحتملين";

async function getOrCreateTabs(sheetId: string, titles: string[]): Promise<Map<string, number>> {
  const meta = await gw(`/${sheetId}`);
  const map = new Map<string, number>();
  for (const s of (meta.sheets||[])) {
    map.set(s.properties?.title, s.properties?.sheetId);
  }
  const toCreate = titles.filter(t => !map.has(t));
  if (toCreate.length) {
    const res = await gw(`/${sheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: toCreate.map(title => ({ addSheet: { properties: { title, rightToLeft: true } } })),
      }),
    });
    for (const r of (res.replies||[])) {
      const p = r.addSheet?.properties;
      if (p) map.set(p.title, p.sheetId);
    }
  }
  return map;
}

async function writeTab(sheetId: string, tab: string, rows: (string|number)[][]) {
  await gw(`/${sheetId}/values/${encodeURIComponent(tab)}!A:Z:clear`, { method: "POST", body: "{}" });
  await gw(`/${sheetId}/values/${encodeURIComponent(tab)}!A1?valueInputOption=RAW`, {
    method: "PUT", body: JSON.stringify({ values: rows }),
  });
}

const SOLID = "SOLID";
const BORDER = { style: SOLID, color: { red: 0.78, green: 0.82, blue: 0.88 } };
const HEADER_BG = { red: 0.10, green: 0.27, blue: 0.50 };
const HEADER_FG = { red: 1, green: 1, blue: 1 };

async function safeBatch(sheetId: string, requests: any[]) {
  if (!requests.length) return;
  try {
    await gw(`/${sheetId}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
  } catch (e) {
    // try one-by-one to skip the failing one
    for (const r of requests) {
      try { await gw(`/${sheetId}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: [r] }) }); } catch {}
    }
  }
}

// money columns per tab (0-based)
function moneyCols(tab: string): number[] {
  if (tab.startsWith("مبنى")) return [4, 5, 6]; // price/paid/remaining
  if (tab === BOOKINGS_TAB) return [9, 10, 11];
  if (tab === ACCOUNTS_TAB) return [6, 7, 8];
  if (tab === INVOICES_TAB) return [5, 6, 7];
  return [];
}

async function formatDataTab(sheetId: string, sid: number, tab: string, cols: number, rowCount: number) {
  const requests: any[] = [];

  // RTL + freeze header
  requests.push({ updateSheetProperties: { properties: { sheetId: sid, rightToLeft: true, gridProperties: { frozenRowCount: 1 } }, fields: "rightToLeft,gridProperties.frozenRowCount" }});

  // Wider default column width (Arabic needs space)
  requests.push({ updateDimensionProperties: { range: { sheetId: sid, dimension: "COLUMNS", startIndex: 0, endIndex: cols }, properties: { pixelSize: 150 }, fields: "pixelSize" }});

  // Taller rows
  if (rowCount > 0) {
    requests.push({ updateDimensionProperties: { range: { sheetId: sid, dimension: "ROWS", startIndex: 0, endIndex: rowCount }, properties: { pixelSize: 32 }, fields: "pixelSize" }});
  }
  // Header height
  requests.push({ updateDimensionProperties: { range: { sheetId: sid, dimension: "ROWS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 40 }, fields: "pixelSize" }});

  // Header style
  requests.push({ repeatCell: {
    range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: cols },
    cell: { userEnteredFormat: {
      backgroundColor: HEADER_BG,
      textFormat: { foregroundColor: HEADER_FG, bold: true, fontSize: 12, fontFamily: "Cairo" },
      horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE",
      wrapStrategy: "WRAP",
    }},
    fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
  }});

  // Body style: right align, middle, wrap, font
  if (rowCount > 1) {
    requests.push({ repeatCell: {
      range: { sheetId: sid, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: cols },
      cell: { userEnteredFormat: {
        textFormat: { fontSize: 11, fontFamily: "Cairo" },
        horizontalAlignment: "RIGHT", verticalAlignment: "MIDDLE",
        wrapStrategy: "WRAP",
      }},
      fields: "userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
    }});

    // Money columns: number format + center
    for (const c of moneyCols(tab)) {
      requests.push({ repeatCell: {
        range: { sheetId: sid, startRowIndex: 1, endRowIndex: rowCount, startColumnIndex: c, endColumnIndex: c + 1 },
        cell: { userEnteredFormat: {
          numberFormat: { type: "NUMBER", pattern: "#,##0\" ر.س\"" },
          horizontalAlignment: "CENTER",
        }},
        fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
      }});
    }
  }

  // Borders all around
  requests.push({ updateBorders: {
    range: { sheetId: sid, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: cols },
    top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, innerHorizontal: BORDER, innerVertical: BORDER,
  }});

  // Banded rows
  requests.push({ addBanding: { bandedRange: {
    range: { sheetId: sid, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: cols },
    rowProperties: {
      headerColor: HEADER_BG,
      firstBandColor: { red: 1, green: 1, blue: 1 },
      secondBandColor: { red: 0.96, green: 0.97, blue: 0.99 },
    },
  }}});

  await safeBatch(sheetId, requests);
}

async function formatDashboard(sheetId: string, sid: number, rowCount: number) {
  const COLS = 5;
  const requests: any[] = [
    { updateSheetProperties: { properties: { sheetId: sid, rightToLeft: true, gridProperties: { frozenRowCount: 0 } }, fields: "rightToLeft,gridProperties.frozenRowCount" }},
    // Column widths
    { updateDimensionProperties: { range: { sheetId: sid, dimension: "COLUMNS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 280 }, fields: "pixelSize" }},
    { updateDimensionProperties: { range: { sheetId: sid, dimension: "COLUMNS", startIndex: 1, endIndex: 2 }, properties: { pixelSize: 180 }, fields: "pixelSize" }},
    { updateDimensionProperties: { range: { sheetId: sid, dimension: "COLUMNS", startIndex: 2, endIndex: 3 }, properties: { pixelSize: 40 }, fields: "pixelSize" }},
    { updateDimensionProperties: { range: { sheetId: sid, dimension: "COLUMNS", startIndex: 3, endIndex: 4 }, properties: { pixelSize: 220 }, fields: "pixelSize" }},
    { updateDimensionProperties: { range: { sheetId: sid, dimension: "COLUMNS", startIndex: 4, endIndex: 5 }, properties: { pixelSize: 180 }, fields: "pixelSize" }},
    // All rows
    { updateDimensionProperties: { range: { sheetId: sid, dimension: "ROWS", startIndex: 0, endIndex: rowCount }, properties: { pixelSize: 34 }, fields: "pixelSize" }},
    // Title row
    { updateDimensionProperties: { range: { sheetId: sid, dimension: "ROWS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 60 }, fields: "pixelSize" }},
    { mergeCells: { range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: COLS }, mergeType: "MERGE_ALL" }},
    { repeatCell: {
      range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: COLS },
      cell: { userEnteredFormat: {
        backgroundColor: HEADER_BG,
        textFormat: { foregroundColor: HEADER_FG, bold: true, fontSize: 20, fontFamily: "Cairo" },
        horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE",
      }},
      fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
    }},
    // Last update row (row 2)
    { mergeCells: { range: { sheetId: sid, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: COLS }, mergeType: "MERGE_ALL" }},
    { repeatCell: {
      range: { sheetId: sid, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: COLS },
      cell: { userEnteredFormat: {
        backgroundColor: { red: 0.93, green: 0.95, blue: 0.98 },
        textFormat: { foregroundColor: { red: 0.30, green: 0.34, blue: 0.40 }, italic: true, fontSize: 10, fontFamily: "Cairo" },
        horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE",
      }},
      fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
    }},
    // Body style for all data
    { repeatCell: {
      range: { sheetId: sid, startRowIndex: 2, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: COLS },
      cell: { userEnteredFormat: {
        textFormat: { fontSize: 12, fontFamily: "Cairo" },
        verticalAlignment: "MIDDLE", horizontalAlignment: "RIGHT",
      }},
      fields: "userEnteredFormat(textFormat,verticalAlignment,horizontalAlignment)",
    }},
    // Borders
    { updateBorders: {
      range: { sheetId: sid, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: COLS },
      top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, innerHorizontal: BORDER, innerVertical: BORDER,
    }},
  ];

  // Section headers: rows where col A has a label and cols B-E empty (we know from buildDashboardRows)
  // Section labels are at known indices: 3 (ملخص عام), 9 (الإيرادات), 18 (تفصيل العدد), 19 (header row), and another section after building rows
  await safeBatch(sheetId, requests);
}

async function formatDashboardSections(sheetId: string, sid: number, sectionRows: number[], tableHeaderRows: number[]) {
  const requests: any[] = [];
  for (const r of sectionRows) {
    requests.push(
      { mergeCells: { range: { sheetId: sid, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 5 }, mergeType: "MERGE_ALL" }},
      { repeatCell: {
        range: { sheetId: sid, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 5 },
        cell: { userEnteredFormat: {
          backgroundColor: { red: 0.20, green: 0.40, blue: 0.65 },
          textFormat: { foregroundColor: HEADER_FG, bold: true, fontSize: 14, fontFamily: "Cairo" },
          horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE",
        }},
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      }},
      { updateDimensionProperties: { range: { sheetId: sid, dimension: "ROWS", startIndex: r, endIndex: r + 1 }, properties: { pixelSize: 44 }, fields: "pixelSize" }},
    );
  }
  for (const r of tableHeaderRows) {
    requests.push({ repeatCell: {
      range: { sheetId: sid, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 5 },
      cell: { userEnteredFormat: {
        backgroundColor: { red: 0.85, green: 0.89, blue: 0.95 },
        textFormat: { bold: true, fontSize: 11, fontFamily: "Cairo" },
        horizontalAlignment: "CENTER", verticalAlignment: "MIDDLE",
      }},
      fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
    }});
  }
  await safeBatch(sheetId, requests);
}

type BStat = { b: number; total: number; available: number; reserved: number; rented: number; priceTotal: number; priceRented: number; priceReserved: number; paid: number };

function fmtPhone(raw: string) {
  if (!raw) return "";
  const s = String(raw).trim();
  const d = s.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("966")) return `+966 ${d.slice(3,5)} ${d.slice(5,8)} ${d.slice(8)}`;
  if (d.length === 10 && d.startsWith("05")) return `${d.slice(0,4)} ${d.slice(4,7)} ${d.slice(7)}`;
  return s;
}

function buildDashboardRows(perBuilding: BStat[]): (string|number)[][] {
  const sum = (k: keyof BStat) => perBuilding.reduce((a, x) => a + (x[k] as number), 0);
  const totalUnits = sum("total");
  const available = sum("available");
  const reserved = sum("reserved");
  const rented = sum("rented");
  const priceTotal = sum("priceTotal");
  const priceRented = sum("priceRented");
  const priceReserved = sum("priceReserved");
  const paid = sum("paid");
  const expectedAnnual = priceRented + priceReserved;
  const remaining = expectedAnnual - paid;
  const occupancy = totalUnits ? ((rented + reserved) / totalUnits) * 100 : 0;
  const rentedPct = totalUnits ? (rented / totalUnits) * 100 : 0;
  const fmtMoney = (n: number) => Math.round(n).toLocaleString("en-US") + " ر.س";
  const fmtPct = (n: number) => n.toFixed(1) + "%";

  const rows: (string | number)[][] = [
    ["لوحة المعلومات — مدينة المعجار", "", "", "", ""],
    [`آخر تحديث: ${new Date().toLocaleString("ar-EG", { timeZone: "Asia/Riyadh" })}`, "", "", "", ""],
    ["", "", "", "", ""],
    ["ملخص عام", "", "", "", ""],
    ["إجمالي الوحدات", totalUnits, "", "نسبة الإشغال", fmtPct(occupancy)],
    ["متاحة", available, "", "نسبة المؤجر", fmtPct(rentedPct)],
    ["محجوزة", reserved, "", "", ""],
    ["مؤجرة", rented, "", "", ""],
    ["", "", "", "", ""],
    ["الإيرادات السنوية", "", "", "", ""],
    ["إجمالي قيمة الوحدات (لو كله مؤجر)", fmtMoney(priceTotal), "", "", ""],
    ["قيمة الوحدات المؤجرة", fmtMoney(priceRented), "", "", ""],
    ["قيمة الوحدات المحجوزة", fmtMoney(priceReserved), "", "", ""],
    ["الإيراد المتوقع (مؤجر + محجوز)", fmtMoney(expectedAnnual), "", "", ""],
    ["المحصّل فعلياً", fmtMoney(paid), "", "", ""],
    ["المتبقي من الإيراد المتوقع", fmtMoney(remaining), "", "", ""],
    ["نسبة التحصيل من المتوقع", fmtPct(expectedAnnual ? (paid / expectedAnnual) * 100 : 0), "", "", ""],
    ["", "", "", "", ""],
    ["تفصيل لكل مبنى — العدد", "", "", "", ""],
    ["المبنى", "إجمالي الوحدات", "متاحة", "محجوزة", "مؤجرة"],
  ];
  for (const r of perBuilding) rows.push([`مبنى ${r.b}`, r.total, r.available, r.reserved, r.rented]);
  rows.push(["", "", "", "", ""]);
  rows.push(["تفصيل لكل مبنى — المالي", "", "", "", ""]);
  rows.push(["المبنى", "قيمة المؤجر", "قيمة المحجوز", "إجمالي متوقع", "نسبة الإشغال"]);
  for (const r of perBuilding) {
    const occ = r.total ? ((r.rented + r.reserved) / r.total) * 100 : 0;
    rows.push([`مبنى ${r.b}`, fmtMoney(r.priceRented), fmtMoney(r.priceReserved), fmtMoney(r.priceRented + r.priceReserved), fmtPct(occ)]);
  }
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type":"application/json" }});
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader }}});
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type":"application/json" }});

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const ok = (roles||[]).some((r:{role:string}) => r.role==="admin" || r.role==="manager");
    if (!ok) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type":"application/json" }});

    const body = await req.json().catch(()=>({}));
    const action: "push" | "pull" | "meta" = body.action || "push";
    const buildings: number[] = Array.isArray(body.buildings) && body.buildings.length
      ? body.buildings : [1,2,3,4,5,6,7,8,9,10];

    const { data: settings } = await admin.from("app_settings").select("buildings_sheet_id").eq("id",1).maybeSingle();
    const sheetId = settings?.buildings_sheet_id;
    if (!sheetId) throw new Error("لم يتم إعداد معرّف الشييت بعد");

    if (action === "meta") {
      const m = await gw(`/${sheetId}`);
      const sheets = (m.sheets||[]).map((x:any)=>({ title: x.properties?.title, sheetId: x.properties?.sheetId }));
      if (body.delete_title) {
        const target = sheets.find((x:any)=>x.title===body.delete_title);
        if (target) {
          await gw(`/${sheetId}:batchUpdate`, { method:"POST", body: JSON.stringify({ requests:[{ deleteSheet:{ sheetId: target.sheetId }}]})});
        }
      }
      return new Response(JSON.stringify({ sheets }), { headers: { ...corsHeaders, "Content-Type":"application/json" }});
    }

    let pushed = 0, pulled = 0, updated = 0;

    if (action === "push") {
      const titles = [
        ...buildings.map(b => tabName(b)),
        DASHBOARD_TAB, BOOKINGS_TAB, TENANTS_TAB, ACCOUNTS_TAB, INVOICES_TAB, LEADS_TAB,
      ];
      const tabIds = await getOrCreateTabs(sheetId, titles);

      // Fetch all data once
      const [
        { data: units },
        { data: tenants },
        { data: tau },
        { data: accs },
        { data: bookings },
        { data: bookingUnits },
        { data: invoices },
        { data: leads },
      ] = await Promise.all([
        admin.from("units").select("id, building_number, unit_number, unit_type, area, activity, price, status").in("building_number", buildings).order("building_number").order("unit_number"),
        admin.from("tenants").select("id, unit_id, tenant_name, phone, business_name, activity_type, cr_number, start_date, end_date, notes, created_at"),
        admin.from("tenant_account_units").select("unit_id, tenant_account_id"),
        admin.from("tenant_accounts").select("id, full_name, phone, email, business_name, activity_type, cr_number, total_price, paid_amount, notes, created_at"),
        admin.from("bookings").select("id, customer_full_name, customer_phone, customer_email, business_name, cr_number, total_area, total_price, paid_amount, units_count, status, payment_plan, offer_number, notes, created_at, expires_at"),
        admin.from("booking_units").select("booking_id, building_number, unit_number, unit_type, area, price, activity"),
        admin.from("invoices").select("invoice_number, customer_name, customer_phone, customer_business, cr_number, amount, paid_amount, paid, paid_at, payment_method, notes, created_at"),
        admin.from("leads").select("full_name, phone, status, notes, last_message_at, created_at"),
      ]);

      const tenantMap = new Map<string, any>();
      (tenants||[]).forEach((t:any) => { if (t.unit_id) tenantMap.set(t.unit_id, t); });
      const accPaid = new Map<string, number>();
      (accs||[]).forEach((a:any) => accPaid.set(a.id, Number(a.paid_amount) || 0));
      const unitPaid = new Map<string, number>();
      (tau||[]).forEach((l:any) => {
        if (!l.unit_id) return;
        const p = accPaid.get(l.tenant_account_id) || 0;
        unitPaid.set(l.unit_id, (unitPaid.get(l.unit_id) || 0) + p);
      });
      const buMap = new Map<string, any[]>();
      (bookingUnits||[]).forEach((bu:any) => {
        const arr = buMap.get(bu.booking_id) || [];
        arr.push(bu);
        buMap.set(bu.booking_id, arr);
      });

      // === Building tabs ===
      const perBuilding: BStat[] = [];
      const buildingTabSheetIds: number[] = [];
      for (const b of buildings) {
        const rows: (string|number)[][] = [UNIT_HEADER];
        const buUnits = (units||[]).filter((u:any) => u.building_number === b);
        const stat: BStat = { b, total: 0, available: 0, reserved: 0, rented: 0, priceTotal: 0, priceRented: 0, priceReserved: 0, paid: 0 };
        for (const u of buUnits) {
          const t = tenantMap.get(u.id) || {};
          const price = Number(u.price) || 0;
          const paid = unitPaid.get(u.id) || 0;
          const remaining = price - paid;
          stat.total++; stat.priceTotal += price; stat.paid += paid;
          if (u.status === "available") stat.available++;
          else if (u.status === "reserved") { stat.reserved++; stat.priceReserved += price; }
          else if (u.status === "rented") { stat.rented++; stat.priceRented += price; }
          rows.push([
            Number(u.unit_number) || "",
            u.unit_type || "", Number(u.area) || 0, u.activity || "",
            price, paid, remaining,
            STATUS_AR[u.status] || u.status || "",
            t.tenant_name || "", fmtPhone(t.phone || ""), t.business_name || "",
            t.cr_number ? "'" + t.cr_number : "",
            t.start_date || "", t.end_date || "", t.notes || "",
          ]);
        }
        perBuilding.push(stat);
        const name = tabName(b);
        await writeTab(sheetId, name, rows);
        const sid = tabIds.get(name); if (sid !== undefined) buildingTabSheetIds.push(sid);
        pushed += rows.length - 1;
      }

      // === Bookings tab ===
      const bookingsHeader = ["رقم العرض","العميل","الجوال","البريد","الاسم التجاري","السجل التجاري","عدد الوحدات","الوحدات","المساحة الكلية","السعر الكلي","المدفوع","المتبقي","خطة الدفع","الحالة","ملاحظات","تاريخ الإنشاء","تاريخ الانتهاء"];
      const bookingsRows: (string|number)[][] = [bookingsHeader];
      for (const bk of (bookings||[])) {
        const us = (buMap.get(bk.id) || []).map((u:any)=>`م${u.building_number}-${u.unit_number}`).join(", ");
        const paid = Number(bk.paid_amount)||0;
        const total = Number(bk.total_price)||0;
        bookingsRows.push([
          bk.offer_number || "", bk.customer_full_name || "", fmtPhone(bk.customer_phone||""),
          bk.customer_email || "", bk.business_name || "", bk.cr_number ? "'"+bk.cr_number : "",
          Number(bk.units_count)||0, us, Number(bk.total_area)||0, total, paid, total - paid,
          bk.payment_plan === "full" ? "كامل" : bk.payment_plan === "70" ? "70%" : bk.payment_plan === "50" ? "50%" : (bk.payment_plan||""),
          BOOKING_STATUS_AR[bk.status] || bk.status || "",
          bk.notes || "",
          bk.created_at ? new Date(bk.created_at).toLocaleString("ar-EG",{timeZone:"Asia/Riyadh"}) : "",
          bk.expires_at ? new Date(bk.expires_at).toLocaleString("ar-EG",{timeZone:"Asia/Riyadh"}) : "",
        ]);
      }
      await writeTab(sheetId, BOOKINGS_TAB, bookingsRows);
      const bookingsSid = tabIds.get(BOOKINGS_TAB);

      // === Tenants tab ===
      const tenantsHeader = ["المبنى","الوحدة","اسم المستأجر","الجوال","الاسم التجاري","النشاط","السجل التجاري","تاريخ البداية","تاريخ النهاية","ملاحظات","تاريخ الإضافة"];
      const tenantsRows: (string|number)[][] = [tenantsHeader];
      const unitById = new Map<string, any>();
      (units||[]).forEach((u:any) => unitById.set(u.id, u));
      // also fetch units for tenants not in selected buildings
      const tenantUnitIds = (tenants||[]).map((t:any)=>t.unit_id).filter(Boolean);
      const missing = tenantUnitIds.filter((id:string)=>!unitById.has(id));
      if (missing.length) {
        const { data: extra } = await admin.from("units").select("id, building_number, unit_number").in("id", missing);
        (extra||[]).forEach((u:any)=>unitById.set(u.id, u));
      }
      for (const t of (tenants||[])) {
        const u = unitById.get(t.unit_id) || {};
        tenantsRows.push([
          u.building_number || "", u.unit_number || "",
          t.tenant_name || "", fmtPhone(t.phone || ""), t.business_name || "",
          t.activity_type || "", t.cr_number ? "'"+t.cr_number : "",
          t.start_date || "", t.end_date || "", t.notes || "",
          t.created_at ? new Date(t.created_at).toLocaleString("ar-EG",{timeZone:"Asia/Riyadh"}) : "",
        ]);
      }
      await writeTab(sheetId, TENANTS_TAB, tenantsRows);
      const tenantsSid = tabIds.get(TENANTS_TAB);

      // === Tenant accounts tab ===
      const accountsHeader = ["الاسم","الجوال","البريد","الاسم التجاري","النشاط","السجل التجاري","إجمالي العقود","المدفوع","المتبقي","ملاحظات","تاريخ الإنشاء"];
      const accountsRows: (string|number)[][] = [accountsHeader];
      for (const a of (accs||[])) {
        const total = Number(a.total_price)||0; const paid = Number(a.paid_amount)||0;
        accountsRows.push([
          a.full_name || "", fmtPhone(a.phone||""), a.email || "", a.business_name || "",
          a.activity_type || "", a.cr_number ? "'"+a.cr_number : "",
          total, paid, total - paid, a.notes || "",
          a.created_at ? new Date(a.created_at).toLocaleString("ar-EG",{timeZone:"Asia/Riyadh"}) : "",
        ]);
      }
      await writeTab(sheetId, ACCOUNTS_TAB, accountsRows);
      const accountsSid = tabIds.get(ACCOUNTS_TAB);

      // === Invoices tab ===
      const invoicesHeader = ["رقم الفاتورة","العميل","الجوال","الاسم التجاري","السجل التجاري","المبلغ","المدفوع","المتبقي","الحالة","طريقة الدفع","تاريخ الدفع","ملاحظات","تاريخ الإنشاء"];
      const invoicesRows: (string|number)[][] = [invoicesHeader];
      for (const i of (invoices||[])) {
        const amt = Number(i.amount)||0; const pd = Number(i.paid_amount)||0;
        invoicesRows.push([
          i.invoice_number || "", i.customer_name || "", fmtPhone(i.customer_phone||""),
          i.customer_business || "", i.cr_number ? "'"+i.cr_number : "",
          amt, pd, amt - pd, i.paid ? "مدفوعة" : "غير مدفوعة",
          i.payment_method || "",
          i.paid_at ? new Date(i.paid_at).toLocaleString("ar-EG",{timeZone:"Asia/Riyadh"}) : "",
          i.notes || "",
          i.created_at ? new Date(i.created_at).toLocaleString("ar-EG",{timeZone:"Asia/Riyadh"}) : "",
        ]);
      }
      await writeTab(sheetId, INVOICES_TAB, invoicesRows);
      const invoicesSid = tabIds.get(INVOICES_TAB);

      // === Leads tab ===
      const leadsHeader = ["الاسم","الجوال","الحالة","ملاحظات","آخر تواصل","تاريخ الإضافة"];
      const leadsRows: (string|number)[][] = [leadsHeader];
      for (const l of (leads||[])) {
        leadsRows.push([
          l.full_name || "", fmtPhone(l.phone||""), l.status || "", l.notes || "",
          l.last_message_at ? new Date(l.last_message_at).toLocaleString("ar-EG",{timeZone:"Asia/Riyadh"}) : "",
          l.created_at ? new Date(l.created_at).toLocaleString("ar-EG",{timeZone:"Asia/Riyadh"}) : "",
        ]);
      }
      await writeTab(sheetId, LEADS_TAB, leadsRows);
      const leadsSid = tabIds.get(LEADS_TAB);

      // === Dashboard ===
      const dashRows = buildDashboardRows(perBuilding);
      await writeTab(sheetId, DASHBOARD_TAB, dashRows);
      const dashSid = tabIds.get(DASHBOARD_TAB);

      // === Apply formatting ===
      try {
        await formatDataTabs(sheetId, buildingTabSheetIds, UNIT_HEADER.length);
        if (bookingsSid !== undefined) await formatDataTabs(sheetId, [bookingsSid], bookingsHeader.length);
        if (tenantsSid !== undefined) await formatDataTabs(sheetId, [tenantsSid], tenantsHeader.length);
        if (accountsSid !== undefined) await formatDataTabs(sheetId, [accountsSid], accountsHeader.length);
        if (invoicesSid !== undefined) await formatDataTabs(sheetId, [invoicesSid], invoicesHeader.length);
        if (leadsSid !== undefined) await formatDataTabs(sheetId, [leadsSid], leadsHeader.length);
        if (dashSid !== undefined) await formatDashboard(sheetId, dashSid, dashRows.length);
      } catch (e) { console.error("formatting error", e); }
    }

    if (action === "pull") {
      for (const b of buildings) {
        const name = tabName(b);
        let result: any;
        try { result = await gw(`/${sheetId}/values/${encodeURIComponent(name)}!A2:O`); } catch { continue; }
        const values: string[][] = result.values || [];
        for (const row of values) {
          const unitNum = parseInt((row[0]||"").trim(), 10);
          if (!unitNum) continue;
          const unit_type = (row[1]||"").trim() || null;
          const area = parseFloat((row[2]||"").replace(/[^\d.]/g,"")) || 0;
          const activity = (row[3]||"").trim() || null;
          const price = parseFloat((row[4]||"").replace(/[^\d.]/g,"")) || 0;
          const statusAr = (row[7]||"").trim();
          const status = AR_STATUS[statusAr] || "available";
          pulled++;
          const { error } = await admin.from("units")
            .update({ unit_type, area, activity, price, status })
            .eq("building_number", b).eq("unit_number", unitNum);
          if (!error) updated++;
        }
      }
    }

    await admin.from("app_settings").update({
      buildings_sheet_last_sync_at: new Date().toISOString(),
      buildings_sheet_last_direction: action,
    }).eq("id", 1);

    return new Response(JSON.stringify({ ok:true, action, pushed, pulled, updated }), {
      headers: { ...corsHeaders, "Content-Type":"application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type":"application/json" }});
  }
});
