// Sync buildings (1-10) units + tenants with Google Sheets via connector gateway
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

const HEADER = [
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
const DASHBOARD_TAB = "داشبورد";

async function ensureTabs(sheetId: string, buildings: number[]) {
  const meta = await gw(`/${sheetId}`);
  const existing = new Set<string>((meta.sheets||[]).map((s:any)=>s.properties?.title));
  const titles = [...buildings.map(b => tabName(b)), DASHBOARD_TAB];
  const requests = titles
    .filter(t => !existing.has(t))
    .map(title => ({ addSheet: { properties: { title } } }));
  if (requests.length) {
    await gw(`/${sheetId}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
  }
}

type BStat = { b: number; total: number; available: number; reserved: number; rented: number; priceTotal: number; priceRented: number; priceReserved: number; paid: number };

async function writeDashboard(sheetId: string, perBuilding: BStat[]) {
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
    ["إجمالي الوحدات", totalUnits, "", "نسبة الإشغال (محجوز+مؤجر)", fmtPct(occupancy)],
    ["متاحة", available, "", "نسبة المؤجر فقط", fmtPct(rentedPct)],
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

  await gw(`/${sheetId}/values/${DASHBOARD_TAB}!A:Z:clear`, { method: "POST", body: "{}" });
  await gw(`/${sheetId}/values/${DASHBOARD_TAB}!A1?valueInputOption=RAW`, {
    method: "PUT", body: JSON.stringify({ values: rows }),
  });
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
    const action: "push" | "pull" = body.action || "push";
    const buildings: number[] = Array.isArray(body.buildings) && body.buildings.length
      ? body.buildings : [1,2,3,4,5,6,7,8,9,10];

    const { data: settings } = await admin.from("app_settings").select("buildings_sheet_id").eq("id",1).maybeSingle();
    const sheetId = settings?.buildings_sheet_id;
    if (!sheetId) throw new Error("لم يتم إعداد معرّف الشييت بعد");

    await ensureTabs(sheetId, buildings);

    let pushed = 0, pulled = 0, updated = 0;

    if (action === "push") {
      const { data: units } = await admin.from("units")
        .select("id, building_number, unit_number, unit_type, area, activity, price, status")
        .in("building_number", buildings)
        .order("building_number").order("unit_number");
      const { data: tenants } = await admin.from("tenants")
        .select("unit_id, tenant_name, phone, business_name, cr_number, start_date, end_date, notes");
      const tenantMap = new Map<string, any>();
      (tenants||[]).forEach(t => { if (t.unit_id) tenantMap.set(t.unit_id, t); });

      // Map unit_id -> paid_amount via tenant_accounts (sum if multiple)
      const { data: tau } = await admin.from("tenant_account_units")
        .select("unit_id, tenant_account_id");
      const { data: accs } = await admin.from("tenant_accounts")
        .select("id, paid_amount");
      const accPaid = new Map<string, number>();
      (accs||[]).forEach(a => accPaid.set(a.id, Number(a.paid_amount) || 0));
      const unitPaid = new Map<string, number>();
      (tau||[]).forEach(l => {
        if (!l.unit_id) return;
        const p = accPaid.get(l.tenant_account_id) || 0;
        unitPaid.set(l.unit_id, (unitPaid.get(l.unit_id) || 0) + p);
      });

      const fmtPhone = (raw: string) => {
        if (!raw) return "";
        const s = String(raw).trim();
        const d = s.replace(/\D/g, "");
        let pretty = s;
        if (d.length === 12 && d.startsWith("966")) {
          pretty = `+966 ${d.slice(3,5)} ${d.slice(5,8)} ${d.slice(8)}`;
        } else if (d.length === 10 && d.startsWith("05")) {
          pretty = `${d.slice(0,4)} ${d.slice(4,7)} ${d.slice(7)}`;
        }
        return pretty;
      };

      const perBuilding: BStat[] = [];
      for (const b of buildings) {
        const rows: (string|number)[][] = [HEADER];
        const buUnits = (units||[]).filter(u => u.building_number === b);
        const stat: BStat = { b, total: 0, available: 0, reserved: 0, rented: 0, priceTotal: 0, priceRented: 0, priceReserved: 0, paid: 0 };
        for (const u of buUnits) {
          const t = tenantMap.get(u.id) || {};
          const price = Number(u.price) || 0;
          const paid = unitPaid.get(u.id) || 0;
          const remaining = price - paid;
          stat.total++;
          stat.priceTotal += price;
          stat.paid += paid;
          if (u.status === "available") stat.available++;
          else if (u.status === "reserved") { stat.reserved++; stat.priceReserved += price; }
          else if (u.status === "rented") { stat.rented++; stat.priceRented += price; }
          rows.push([
            Number(u.unit_number) || "",
            u.unit_type || "",
            Number(u.area) || 0,
            u.activity || "",
            price,
            paid,
            remaining,
            STATUS_AR[u.status] || u.status || "",
            t.tenant_name || "",
            fmtPhone(t.phone || ""),
            t.business_name || "",
            t.cr_number ? "'" + t.cr_number : "",
            t.start_date || "",
            t.end_date || "",
            t.notes || "",
          ]);
        }
        perBuilding.push(stat);
        const name = tabName(b);
        await gw(`/${sheetId}/values/${name}!A:Z:clear`, { method:"POST", body:"{}" });
        await gw(`/${sheetId}/values/${name}!A1?valueInputOption=RAW`, {
          method:"PUT", body: JSON.stringify({ values: rows }),
        });
        pushed += rows.length - 1;
      }
      try { await writeDashboard(sheetId, perBuilding); } catch (e) { console.error("dashboard write failed", e); }
    }

    if (action === "pull") {
      for (const b of buildings) {
        const name = tabName(b);
        let result: any;
        try { result = await gw(`/${sheetId}/values/${name}!A2:O`); } catch { continue; }
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
