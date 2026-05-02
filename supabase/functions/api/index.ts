// Public REST API for external apps (mobile, integrations).
// Auth: either `X-API-Key: nkb_...` OR `Authorization: Bearer <jwt>`.
// Routes are prefixed with /api inside the function path.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Scope = "read" | "write" | "admin";
interface AuthCtx {
  type: "api_key" | "jwt";
  scopes: Scope[];
  userId?: string;
  isAdmin?: boolean;
  apiKeyId?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(message: string, status = 400, extra?: Record<string, unknown>) {
  return json({ error: message, ...(extra ?? {}) }, status);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function authenticate(req: Request): Promise<AuthCtx | null> {
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("X-API-Key");
  if (apiKey) {
    const hash = await sha256Hex(apiKey);
    const { data, error } = await admin.rpc("verify_api_key", {
      _key_hash: hash,
    });
    if (error || !data || data.length === 0) return null;
    const row = data[0] as { id: string; scopes: Scope[]; is_valid: boolean };
    if (!row.is_valid) return null;
    // fire-and-forget last_used update
    admin.rpc("touch_api_key", { _id: row.id }).then(() => {});
    return { type: "api_key", scopes: row.scopes, apiKeyId: row.id };
  }

  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data, error } = await userClient.auth.getClaims(token);
    if (error || !data?.claims) return null;
    const userId = data.claims.sub as string;
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    return {
      type: "jwt",
      userId,
      isAdmin,
      scopes: isAdmin ? ["read", "write", "admin"] : ["read"],
    };
  }
  return null;
}

function requireScope(ctx: AuthCtx, scope: Scope): Response | null {
  if (!ctx.scopes.includes(scope) && !ctx.scopes.includes("admin")) {
    return err(`This endpoint requires '${scope}' scope`, 403);
  }
  return null;
}

// ---------- Route handlers ----------
async function listBuildings() {
  const [{ data: buildings, error: be }, { data: units, error: ue }] =
    await Promise.all([
      admin.from("buildings").select("*").order("number"),
      admin.from("units").select("building_number,status").limit(5000),
    ]);
  if (be) return err(be.message, 500);
  if (ue) return err(ue.message, 500);
  const result = (buildings ?? []).map((b) => {
    const bu = (units ?? []).filter((u) => u.building_number === b.number);
    const rented = bu.filter((u) => u.status === "rented").length;
    const reserved = bu.filter((u) => u.status === "reserved").length;
    return {
      number: b.number,
      type: b.type,
      total_units: bu.length,
      rented_units: rented,
      reserved_units: reserved,
      available_units: bu.length - rented - reserved,
      expected_annual_revenue: Number(b.expected_annual_revenue),
    };
  });
  return json({ data: result, count: result.length });
}

async function getBuilding(num: number) {
  const { data, error } = await admin
    .from("buildings")
    .select("*")
    .eq("number", num)
    .maybeSingle();
  if (error) return err(error.message, 500);
  if (!data) return err("Building not found", 404);
  const { data: units } = await admin
    .from("units")
    .select("*")
    .eq("building_number", num)
    .order("unit_number");
  return json({ data: { ...data, units: units ?? [] } });
}

async function listUnits(url: URL) {
  let q = admin.from("units").select("*").limit(2000);
  const status = url.searchParams.get("status");
  const building = url.searchParams.get("building_number");
  const activity = url.searchParams.get("activity");
  if (status) q = q.eq("status", status);
  if (building) q = q.eq("building_number", Number(building));
  if (activity) q = q.ilike("activity", `%${activity}%`);
  const { data, error } = await q
    .order("building_number")
    .order("unit_number");
  if (error) return err(error.message, 500);
  return json({ data, count: data?.length ?? 0 });
}

async function getUnit(id: string) {
  const { data, error } = await admin
    .from("units")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return err(error.message, 500);
  if (!data) return err("Unit not found", 404);
  const { data: tenant } = await admin
    .from("tenants")
    .select("*")
    .eq("unit_id", id)
    .maybeSingle();
  return json({ data: { ...data, tenant } });
}

async function createBooking(body: any) {
  if (!body?.customer?.fullName || !body?.customer?.phone) {
    return err("customer.fullName and customer.phone are required", 400);
  }
  if (!Array.isArray(body.units) || body.units.length === 0) {
    return err("units array is required", 400);
  }
  const webhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
  if (!webhookUrl) return err("Booking webhook not configured", 500);
  const totalArea = body.units.reduce(
    (s: number, u: any) => s + (Number(u.area) || 0),
    0,
  );
  const totalPrice = body.units.reduce(
    (s: number, u: any) => s + (Number(u.price) || 0),
    0,
  );
  const payload = {
    source: "نخبة تسكين - API",
    submitted_at: new Date().toISOString(),
    customer: body.customer,
    units: body.units,
    totals: {
      units_count: body.units.length,
      total_area: totalArea,
      total_annual_price: totalPrice,
      vat_note: "السعر غير شامل ضريبة القيمة المضافة 15%",
    },
    whatsapp_message: body.message ?? null,
  };
  const r = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text();
    return err(`Booking webhook failed [${r.status}]`, 502, { details: t });
  }
  return json({ success: true, booking_id: crypto.randomUUID() }, 201);
}

async function listTenants(url: URL) {
  let q = admin.from("tenants").select("*, units(building_number, unit_number)");
  const search = url.searchParams.get("search");
  if (search) q = q.ilike("tenant_name", `%${search}%`);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) return err(error.message, 500);
  return json({ data, count: data?.length ?? 0 });
}

async function createTenant(body: any) {
  if (!body?.unit_id || !body?.tenant_name) {
    return err("unit_id and tenant_name are required", 400);
  }
  const { data, error } = await admin
    .from("tenants")
    .insert({
      unit_id: body.unit_id,
      tenant_name: body.tenant_name,
      business_name: body.business_name ?? null,
      phone: body.phone ?? null,
      activity_type: body.activity_type ?? null,
      start_date: body.start_date ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();
  if (error) return err(error.message, 400);
  await admin.from("units").update({ status: "rented" }).eq("id", body.unit_id);
  return json({ data }, 201);
}

async function updateTenant(id: string, body: any) {
  const { data, error } = await admin
    .from("tenants")
    .update(body)
    .eq("id", id)
    .select()
    .single();
  if (error) return err(error.message, 400);
  return json({ data });
}

async function deleteTenant(id: string) {
  const { data: tenant } = await admin
    .from("tenants")
    .select("unit_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await admin.from("tenants").delete().eq("id", id);
  if (error) return err(error.message, 400);
  if (tenant?.unit_id) {
    await admin
      .from("units")
      .update({ status: "available" })
      .eq("id", tenant.unit_id);
  }
  return json({ success: true });
}

async function getStats() {
  const { data: units } = await admin
    .from("units")
    .select("status, price")
    .limit(5000);
  const { data: buildings } = await admin.from("buildings").select("number");
  const u = units ?? [];
  const total = u.length;
  const rented = u.filter((x) => x.status === "rented").length;
  const reserved = u.filter((x) => x.status === "reserved").length;
  const available = total - rented - reserved;
  const actualRevenue = u
    .filter((x) => x.status === "rented")
    .reduce((s, x) => s + Number(x.price), 0);
  const potentialRevenue = u.reduce((s, x) => s + Number(x.price), 0);
  return json({
    data: {
      buildings_count: buildings?.length ?? 0,
      units: { total, rented, reserved, available },
      occupancy_rate: total > 0 ? +((rented / total) * 100).toFixed(2) : 0,
      revenue: {
        actual_annual: actualRevenue,
        potential_annual: potentialRevenue,
        currency: "SAR",
        vat_note: "السعر غير شامل ضريبة القيمة المضافة 15%",
      },
    },
  });
}

// ---------- Router ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  // Strip the function name prefix; supports both /api and /functions/v1/api
  let path = url.pathname.replace(/^\/functions\/v1\/api/, "").replace(/^\/api/, "");
  if (path === "" || path === "/") path = "/";

  // Public meta endpoint
  if (path === "/" && req.method === "GET") {
    return json({
      name: "نخبة تسكين API",
      version: "1.0.0",
      docs: "/api-docs",
      endpoints: [
        "GET /buildings",
        "GET /buildings/:number",
        "GET /units",
        "GET /units/:id",
        "POST /bookings",
        "GET /tenants",
        "POST /tenants",
        "PATCH /tenants/:id",
        "DELETE /tenants/:id",
        "GET /stats",
      ],
    });
  }

  const ctx = await authenticate(req);
  if (!ctx) {
    return err(
      "Unauthorized. Provide X-API-Key header or Authorization: Bearer <jwt>.",
      401,
    );
  }

  try {
    // GET /buildings
    if (path === "/buildings" && req.method === "GET") {
      const g = requireScope(ctx, "read");
      return g ?? (await listBuildings());
    }
    // GET /buildings/:number
    const buildingMatch = path.match(/^\/buildings\/(\d+)$/);
    if (buildingMatch && req.method === "GET") {
      const g = requireScope(ctx, "read");
      return g ?? (await getBuilding(Number(buildingMatch[1])));
    }
    // GET /units
    if (path === "/units" && req.method === "GET") {
      const g = requireScope(ctx, "read");
      return g ?? (await listUnits(url));
    }
    // GET /units/:id
    const unitMatch = path.match(/^\/units\/([0-9a-f-]{36})$/i);
    if (unitMatch && req.method === "GET") {
      const g = requireScope(ctx, "read");
      return g ?? (await getUnit(unitMatch[1]));
    }
    // POST /bookings
    if (path === "/bookings" && req.method === "POST") {
      const g = requireScope(ctx, "read"); // bookings allowed for any authed key
      if (g) return g;
      return await createBooking(await req.json());
    }
    // /tenants
    if (path === "/tenants" && req.method === "GET") {
      const g = requireScope(ctx, "write");
      return g ?? (await listTenants(url));
    }
    if (path === "/tenants" && req.method === "POST") {
      const g = requireScope(ctx, "write");
      if (g) return g;
      return await createTenant(await req.json());
    }
    const tenantMatch = path.match(/^\/tenants\/([0-9a-f-]{36})$/i);
    if (tenantMatch && req.method === "PATCH") {
      const g = requireScope(ctx, "write");
      if (g) return g;
      return await updateTenant(tenantMatch[1], await req.json());
    }
    if (tenantMatch && req.method === "DELETE") {
      const g = requireScope(ctx, "admin");
      return g ?? (await deleteTenant(tenantMatch[1]));
    }
    // GET /stats
    if (path === "/stats" && req.method === "GET") {
      const g = requireScope(ctx, "read");
      return g ?? (await getStats());
    }
    return err(`Route not found: ${req.method} ${path}`, 404);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("API error:", msg);
    return err(msg, 500);
  }
});
