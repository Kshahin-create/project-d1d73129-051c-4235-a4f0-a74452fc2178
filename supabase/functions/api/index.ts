// Legacy external API — READ-ONLY.
// Auth: either `X-API-Key: nkb_...` OR `Authorization: Bearer <jwt>`.
// Returns unit fields and aggregate counts only. No personal data (names, phones,
// emails, ID/CR numbers, user IDs) is ever returned. All write routes were removed.
// CORS origins come from app_settings.api_cors_allowlist.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BASE_CORS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  Vary: "Origin",
};

let allowCache: { at: number; list: string[] } | null = null;
async function getAllowList(): Promise<string[]> {
  if (allowCache && Date.now() - allowCache.at < 60_000) return allowCache.list;
  const { data } = await admin.from("app_settings").select("api_cors_allowlist").eq("id", 1).maybeSingle();
  const list = ((data as any)?.api_cors_allowlist ?? []) as string[];
  allowCache = { at: Date.now(), list };
  return list;
}

function corsFor(origin: string | null, allow: string[]): Record<string, string> {
  if (origin && allow.includes(origin.replace(/\/$/, ""))) {
    return { ...BASE_CORS, "Access-Control-Allow-Origin": origin };
  }
  return { ...BASE_CORS };
}

let CORS: Record<string, string> = { ...BASE_CORS };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function err(message: string, status = 400) {
  return json({ error: message }, status);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticate(req: Request): Promise<boolean> {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const { data, error } = await admin.rpc("verify_api_key", { _key_hash: await sha256Hex(apiKey) });
    if (error || !data || data.length === 0) return false;
    const row = data[0] as { id: string; is_valid: boolean };
    if (!row.is_valid) return false;
    admin.rpc("touch_api_key", { _id: row.id }).then(() => {});
    return true;
  }
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data, error } = await userClient.auth.getClaims(auth.slice(7));
    return !error && !!data?.claims?.sub;
  }
  return false;
}

const UNIT_FIELDS = "id, building_number, unit_number, unit_type, area, activity, price, status";

async function listBuildings() {
  const [{ data: buildings, error: be }, { data: units, error: ue }] = await Promise.all([
    admin.from("buildings").select("number, type, expected_annual_revenue, booking_enabled").order("number"),
    admin.from("units").select("building_number,status").eq("is_test", false).eq("publish_state", "published").limit(10000),
  ]);
  if (be) return err(be.message, 500);
  if (ue) return err(ue.message, 500);
  const result = (buildings ?? []).map((b: any) => {
    const bu = (units ?? []).filter((u: any) => u.building_number === b.number);
    const count = (s: string) => bu.filter((u: any) => u.status === s).length;
    return {
      number: b.number,
      type: b.type,
      booking_enabled: b.booking_enabled,
      total_units: bu.length,
      available_units: count("available"),
      reserved_units: count("reserved"),
      rented_units: count("rented"),
      maintenance_units: count("maintenance"),
      expected_annual_revenue: Number(b.expected_annual_revenue),
    };
  });
  return json({ data: result, count: result.length });
}

async function getBuilding(num: number) {
  const { data, error } = await admin.from("buildings")
    .select("number, type, expected_annual_revenue, booking_enabled").eq("number", num).maybeSingle();
  if (error) return err(error.message, 500);
  if (!data) return err("Building not found", 404);
  const { data: units } = await admin.from("units").select(UNIT_FIELDS).eq("is_test", false).eq("publish_state", "published").eq("building_number", num).order("unit_number");
  return json({ data: { ...data, units: units ?? [] } });
}

async function listUnits(url: URL) {
  let q = admin.from("units").select(UNIT_FIELDS).eq("is_test", false).eq("publish_state", "published").limit(5000);
  const status = url.searchParams.get("status");
  const building = url.searchParams.get("building_number");
  const activity = url.searchParams.get("activity");
  if (status) q = q.eq("status", status);
  if (building) q = q.eq("building_number", Number(building));
  if (activity) q = q.ilike("activity", `%${activity}%`);
  const { data, error } = await q.order("building_number").order("unit_number");
  if (error) return err(error.message, 500);
  return json({ data, count: data?.length ?? 0 });
}

async function getUnit(id: string) {
  const { data, error } = await admin.from("units").select(UNIT_FIELDS).eq("is_test", false).eq("publish_state", "published").eq("id", id).maybeSingle();
  if (error) return err(error.message, 500);
  if (!data) return err("Unit not found", 404);
  return json({ data });
}

// Bookings: real database IDs, unit/aggregate fields only — no customer data.
const BOOKING_FIELDS =
  "id, offer_number, status, units_count, total_area, total_price, payment_plan, created_at, expires_at, booking_units(unit_id, building_number, unit_number, unit_type, area, price, activity)";

async function listBookings(url: URL) {
  let q = admin.from("bookings").select(BOOKING_FIELDS).is("archived_at", null).limit(1000);
  const status = url.searchParams.get("status");
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) return err(error.message, 500);
  return json({ data, count: data?.length ?? 0 });
}

async function getBooking(id: string) {
  const { data, error } = await admin.from("bookings").select(BOOKING_FIELDS).eq("id", id).maybeSingle();
  if (error) return err(error.message, 500);
  if (!data) return err("Booking not found", 404);
  return json({ data });
}

function unitCounts(u: { status: string }[]) {
  const c = (s: string) => u.filter((x) => x.status === s).length;
  return {
    total: u.length,
    available: c("available"),
    reserved: c("reserved"),
    rented: c("rented"),
    maintenance: c("maintenance"),
  };
}

async function getStats() {
  const [{ data: units }, { data: buildings }] = await Promise.all([
    admin.from("units").select("status, price").eq("is_test", false).eq("publish_state", "published").limit(10000),
    admin.from("buildings").select("number"),
  ]);
  const u = (units ?? []) as { status: string; price: number }[];
  const counts = unitCounts(u);
  return json({
    data: {
      buildings_count: buildings?.length ?? 0,
      units: counts,
      occupancy_rate: counts.total > 0 ? +((counts.rented / counts.total) * 100).toFixed(2) : 0,
      revenue: {
        actual_annual_excl_vat: u.filter((x) => x.status === "rented").reduce((s, x) => s + Number(x.price), 0),
        potential_annual_excl_vat: u.reduce((s, x) => s + Number(x.price), 0),
        currency: "SAR",
        vat_included: false,
      },
    },
  });
}

async function getOverview(days: number) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceIso = since.toISOString();
  const [units, buildings, profiles, bookings, emailRows] = await Promise.all([
    admin.from("units").select("status").eq("is_test", false).eq("publish_state", "published").limit(10000),
    admin.from("buildings").select("number"),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
    admin.from("bookings").select("total_price").gte("created_at", sinceIso),
    admin.from("email_send_log").select("message_id, status, template_name, created_at")
      .gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(5000),
  ]);
  const counts = unitCounts((units.data ?? []) as { status: string }[]);
  const seen = new Set<string>();
  const emailCounts = { total: 0, sent: 0, failed: 0, suppressed: 0 };
  for (const r of emailRows.data ?? []) {
    const k = r.message_id ?? `${r.template_name}-${r.created_at}`;
    if (seen.has(k)) continue;
    seen.add(k);
    emailCounts.total++;
    if (r.status === "sent") emailCounts.sent++;
    else if (["dlq", "failed", "bounced"].includes(r.status)) emailCounts.failed++;
    else if (["suppressed", "complained"].includes(r.status)) emailCounts.suppressed++;
  }
  const bk = bookings.data ?? [];
  return json({
    data: {
      range_days: days,
      buildings_count: buildings.data?.length ?? 0,
      units: { ...counts, occupancy_rate: counts.total > 0 ? +((counts.rented / counts.total) * 100).toFixed(2) : 0 },
      new_signups: profiles.count ?? 0,
      bookings: {
        count: bk.length,
        total_value_excl_vat: bk.reduce((s, r: any) => s + Number(r.total_price ?? 0), 0),
        vat_included: false,
      },
      emails: emailCounts,
    },
  });
}

const REMOVED = [/^\/tenants/, /^\/tenant-accounts/, /^\/customers/, /^\/users/, /^\/audit-log/, /^\/invoices/];

Deno.serve(async (req) => {
  CORS = corsFor(req.headers.get("Origin"), await getAllowList().catch(() => []));
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  let path = url.pathname.replace(/^\/functions\/v1\/api/, "").replace(/^\/api/, "");
  if (path === "") path = "/";

  if (!["GET", "HEAD"].includes(req.method)) {
    return err("This API is read-only. Only GET requests are allowed.", 405);
  }

  if (path === "/") {
    return json({
      name: "MNICity API",
      version: "2.0.0",
      read_only: true,
      docs: "/api-docs",
      endpoints: [
        "GET /buildings",
        "GET /buildings/:number",
        "GET /units",
        "GET /units/:id",
        "GET /bookings",
        "GET /bookings/:id",
        "GET /stats",
        "GET /stats/overview?days=N",
      ],
    });
  }

  if (REMOVED.some((r) => r.test(path))) {
    return err("This endpoint was removed because it exposed personal data.", 410);
  }

  if (!(await authenticate(req))) {
    return err("Unauthorized. Provide X-API-Key header or Authorization: Bearer <jwt>.", 401);
  }

  try {
    if (path === "/buildings") return await listBuildings();
    const b = path.match(/^\/buildings\/(\d+)$/);
    if (b) return await getBuilding(Number(b[1]));
    if (path === "/units") return await listUnits(url);
    const u = path.match(/^\/units\/([0-9a-f-]{36})$/i);
    if (u) return await getUnit(u[1]);
    if (path === "/bookings") return await listBookings(url);
    const bk = path.match(/^\/bookings\/([0-9a-f-]{36})$/i);
    if (bk) return await getBooking(bk[1]);
    if (path === "/stats") return await getStats();
    if (path === "/stats/overview") {
      const days = Math.min(Math.max(1, Number(url.searchParams.get("days") ?? "7") || 7), 90);
      return await getOverview(days);
    }
    return err(`Route not found: GET ${path}`, 404);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("API error:", msg);
    return err("Internal error", 500);
  }
});
