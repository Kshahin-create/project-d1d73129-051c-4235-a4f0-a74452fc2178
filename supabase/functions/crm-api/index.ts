// Read-only REST API for an external CRM (server-to-server). GET only.
// Auth: header `X-API-Key` (key created in /admin/api-keys with crm:* scopes).
import { createClient } from "npm:@supabase/supabase-js@2";
import { decodeCursor, encodeCursor, hasCrmAccess, parseLimit, redact } from "./logic.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const API_VERSION = "1.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (code: string, message: string, status: number) => json({ error: { code, message } }, status);

async function sha256Hex(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

interface Resource {
  table: string;
  select: string;
  ts: "updated_at" | "created_at";
  pii: string[];
  finance: string[];
  filters: Record<string, "text" | "int" | "uuid" | "bool">;
  map?: (r: Record<string, unknown>, scopes: string[]) => Record<string, unknown>;
  base?: (q: any) => any;
}

const BOOKING_PII = ["customer_full_name", "customer_phone", "customer_email", "business_name", "cr_number", "notes", "offer_image_url"];
const R: Record<string, Resource> = {
  buildings: {
    table: "buildings", select: "id,number,type,expected_annual_revenue,created_at,updated_at", ts: "updated_at",
    pii: [], finance: ["expected_annual_revenue"], filters: { type: "text", number: "int" },
  },
  units: {
    table: "units", select: "id,building_number,unit_number,unit_type,activity,area,price,status,created_at,updated_at", ts: "updated_at",
    pii: [], finance: [], filters: { status: "text", building_number: "int", activity: "text", unit_type: "text" },
  },
  bookings: {
    table: "bookings",
    select: "id,offer_number,status,payment_plan,units_count,total_area,total_price,paid_amount,customer_full_name,customer_phone,customer_email,business_name,cr_number,notes,offer_image_url,is_returning_customer,previous_tenant_account_id,expires_at,confirmation_sent_at,created_at,updated_at,booking_units(unit_id,building_number,unit_number,unit_type,area,price,activity)",
    ts: "updated_at", pii: BOOKING_PII, finance: ["paid_amount"], filters: { status: "text", payment_plan: "text" },
  },
  customers: {
    table: "tenant_accounts",
    select: "id,full_name,phone,email,business_name,cr_number,activity_type,notes,total_price,paid_amount,merged_into,merged_at,created_at,updated_at,tenant_account_units(unit_id)",
    ts: "updated_at", pii: ["full_name", "phone", "email", "business_name", "cr_number", "notes"], finance: ["total_price", "paid_amount"],
    filters: { activity_type: "text", merged_into: "uuid" },
    map: (r) => ({ ...r, unit_ids: ((r.tenant_account_units as any[]) ?? []).map((u) => u.unit_id), tenant_account_units: undefined, is_merged: r.merged_into != null }),
  },
  tenancies: {
    table: "tenants",
    select: "id,unit_id,booking_id,tenant_name,business_name,activity_type,phone,cr_number,start_date,end_date,notes,offer_image_url,created_at,updated_at",
    ts: "updated_at", pii: ["tenant_name", "business_name", "phone", "cr_number", "notes", "offer_image_url"], finance: [],
    filters: { unit_id: "uuid", booking_id: "uuid" },
  },
  invoices: {
    table: "invoices",
    select: "id,invoice_number,tenant_account_id,booking_id,unit_id,amount,paid_amount,paid,paid_at,due_date,period_start,period_end,payment_method,customer_name,customer_phone,customer_business,cr_number,notes,created_at,updated_at",
    ts: "updated_at", pii: ["customer_name", "customer_phone", "customer_business", "cr_number", "notes"], finance: [],
    filters: { paid: "bool", tenant_account_id: "uuid", booking_id: "uuid" },
  },
  collections: {
    table: "unit_collections",
    select: "id,unit_id,tenant_account_id,amount,is_archived,proof_name,proof_mime,created_at,updated_at",
    ts: "updated_at", pii: ["proof_name"], finance: [], filters: { unit_id: "uuid", tenant_account_id: "uuid", is_archived: "bool" },
  },
  leads: {
    table: "interested_customers",
    select: "id,full_name,phone,business_name,requested_activity,requested_building,requested_unit,customer_source,source,status,notes,created_at,updated_at",
    ts: "updated_at", pii: ["full_name", "phone", "business_name", "notes"], finance: [], filters: { status: "text", source: "text" },
  },
};
// Whole resources that require extra scopes.
const NEEDS: Record<string, string> = { invoices: "crm:finance", collections: "crm:finance", leads: "crm:pii" };

function shape(res: Resource, row: Record<string, unknown>, scopes: string[]) {
  let r = res.map ? res.map(row, scopes) : row;
  if (Array.isArray(r.booking_units) && !scopes.includes("crm:finance")) {
    r = { ...r, booking_units: (r.booking_units as any[]).map((u) => ({ ...u })) };
  }
  r = redact(r, scopes, res.pii, res.finance);
  for (const k of Object.keys(r)) if (r[k] === undefined) delete r[k];
  return r;
}

function applyFilters(q: any, res: Resource, url: URL): string | null {
  for (const [k, kind] of Object.entries(res.filters)) {
    const v = url.searchParams.get(k);
    if (v == null || v === "") continue;
    if (kind === "int" && !/^\d+$/.test(v)) return k;
    if (kind === "uuid" && v !== "null" && !/^[0-9a-f-]{36}$/i.test(v)) return k;
    if (kind === "bool" && !["true", "false"].includes(v)) return k;
    if (kind === "text" && v.length > 100) return k;
    if (kind === "uuid" && v === "null") q = q.is(k, null);
    else q = q.eq(k, kind === "int" ? Number(v) : kind === "bool" ? v === "true" : v);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return fail("method_not_allowed", "This API is read-only. Use GET.", 405);

  const key = req.headers.get("x-api-key");
  if (!key) return fail("unauthorized", "Missing X-API-Key header", 401);
  const { data: kd } = await admin.rpc("verify_api_key", { _key_hash: await sha256Hex(key) });
  const k = (kd as any[])?.[0];
  if (!k || !k.is_valid) return fail("unauthorized", "Invalid, revoked or expired API key", 401);
  const scopes: string[] = k.scopes ?? [];
  if (!hasCrmAccess(scopes)) return fail("forbidden", "Key lacks 'crm:read' scope", 403);
  admin.rpc("touch_api_key", { _id: k.id }).then(() => {});

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/crm-api/, "").replace(/\/+$/, "") || "/";

  try {
    if (path === "/" || path === "/meta") {
      return json({
        data: {
          api_version: API_VERSION,
          project: { code: "MNICITY", name_ar: "المدينة الصناعية بشمال مكة المكرمة" },
          phase: { code: "phase-1", name_ar: "المرحلة الأولى", note: "Single phase; no phases table exists." },
          scopes, resources: Object.keys(R), server_time: new Date().toISOString(),
        },
      });
    }
    const m = path.match(/^\/([a-z]+)(?:\/([0-9a-f-]{36}))?$/i);
    const res = m && R[m[1]];
    if (!m || !res) return fail("not_found", `Unknown route ${path}`, 404);
    const need = NEEDS[m[1]];
    if (need && !scopes.includes(need)) return fail("forbidden", `Resource requires '${need}' scope`, 403);

    if (m[2]) {
      const { data, error } = await admin.from(res.table).select(res.select).eq("id", m[2]).maybeSingle();
      if (error) throw error;
      if (!data) return fail("not_found", "Record not found", 404);
      return json({ data: shape(res, data as any, scopes) });
    }

    const limit = parseLimit(url.searchParams.get("limit"));
    const rawCursor = url.searchParams.get("cursor");
    const cursor = decodeCursor(rawCursor);
    if (rawCursor && !cursor) return fail("bad_request", "Invalid cursor", 400);
    const since = url.searchParams.get("updated_since");
    if (since && isNaN(Date.parse(since))) return fail("bad_request", "updated_since must be ISO-8601", 400);

    let q: any = admin.from(res.table).select(res.select)
      .order(res.ts, { ascending: true }).order("id", { ascending: true }).limit(limit + 1);
    if (since) q = q.gte(res.ts, new Date(since).toISOString());
    if (cursor) q = q.or(`${res.ts}.gt.${cursor.t},and(${res.ts}.eq.${cursor.t},id.gt.${cursor.id})`);
    const bad = applyFilters(q, res, url);
    if (bad) return fail("bad_request", `Invalid value for filter '${bad}'`, 400);
    // applyFilters returns a new builder via reassignment; rebuild with filters applied
    for (const [k2, kind] of Object.entries(res.filters)) {
      const v = url.searchParams.get(k2);
      if (v == null || v === "") continue;
      q = kind === "uuid" && v === "null" ? q.is(k2, null) : q.eq(k2, kind === "int" ? Number(v) : kind === "bool" ? v === "true" : v);
    }
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as Record<string, any>[];
    const more = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return json({
      data: page.map((r) => shape(res, r, scopes)),
      pagination: { limit, has_more: more, next_cursor: more && last ? encodeCursor({ t: last[res.ts], id: last.id }) : null },
      sync: { timestamp_field: res.ts, server_time: new Date().toISOString() },
    });
  } catch (e) {
    console.error("crm-api error", e);
    return fail("internal_error", "Unexpected server error", 500);
  }
});
