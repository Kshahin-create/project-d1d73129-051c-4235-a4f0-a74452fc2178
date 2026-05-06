// MCP Server for Mnicejar - exposes platform data/tools to MCP clients.
// Auth: requires `X-API-Key: nkb_...` header (verified via verify_api_key RPC).
import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Scope = "read" | "write" | "admin";
async function verifyApiKey(
  req: Request,
): Promise<{ id: string; scopes: Scope[] } | null> {
  const apiKey =
    req.headers.get("x-api-key") ?? req.headers.get("X-API-Key");
  if (!apiKey) return null;
  const hash = await sha256Hex(apiKey);
  const { data, error } = await admin.rpc("verify_api_key", {
    _key_hash: hash,
  });
  if (error || !data || data.length === 0) return null;
  const row = data[0] as { id: string; scopes: Scope[]; is_valid: boolean };
  if (!row.is_valid) return null;
  admin.rpc("touch_api_key", { _id: row.id }).then(() => {});
  return { id: row.id, scopes: row.scopes };
}

function text(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text:
          typeof payload === "string"
            ? payload
            : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

const mcp = new McpServer({
  name: "mnicejar-mcp",
  version: "1.0.0",
  schemaAdapter: (schema) => z.toJSONSchema(schema as z.ZodType),
});

// ---------- Tools ----------

mcp.tool("list_buildings", {
  description: "قائمة العمائر مع نوعها ورقمها والإيراد السنوي المتوقع.",
  inputSchema: z.object({}),
  handler: async () => {
    const { data, error } = await admin
      .from("buildings")
      .select("number,type,expected_annual_revenue")
      .order("number");
    if (error) return text({ error: error.message });
    return text(data);
  },
});

mcp.tool("list_units", {
  description:
    "قائمة الوحدات. يمكن التصفية بالحالة (available/rented/reserved) أو رقم العمارة.",
  inputSchema: z.object({
    status: z.enum(["available", "rented", "reserved"]).optional(),
    building_number: z.number().optional(),
    limit: z.number().optional(),
  }),
  handler: async (args) => {
    let q = admin
      .from("units")
      .select(
        "id,building_number,unit_number,unit_type,area,activity,price,status",
      )
      .order("building_number")
      .order("unit_number")
      .limit(args.limit ?? 100);
    if (args.status) q = q.eq("status", args.status);
    if (args.building_number) q = q.eq("building_number", args.building_number);
    const { data, error } = await q;
    if (error) return text({ error: error.message });
    return text(data);
  },
});

mcp.tool("get_unit", {
  description: "تفاصيل وحدة برقم العمارة ورقم الوحدة.",
  inputSchema: z.object({
    building_number: z.number(),
    unit_number: z.number(),
  }),
  handler: async (args) => {
    const { data, error } = await admin
      .from("units")
      .select("*")
      .eq("building_number", args.building_number)
      .eq("unit_number", args.unit_number)
      .maybeSingle();
    if (error) return text({ error: error.message });
    return text(data ?? { error: "not_found" });
  },
});

mcp.tool("search_units", {
  description:
    "بحث عن وحدات متاحة بحدّ أعلى للسعر و/أو حدّ أدنى للمساحة و/أو نوع وحدة.",
  inputSchema: z.object({
    max_price: z.number().optional(),
    min_area: z.number().optional(),
    unit_type: z.string().optional(),
    limit: z.number().optional(),
  }),
  handler: async (args) => {
    let q = admin
      .from("units")
      .select(
        "id,building_number,unit_number,unit_type,area,activity,price,status",
      )
      .eq("status", "available")
      .limit(args.limit ?? 50);
    if (args.max_price) q = q.lte("price", args.max_price);
    if (args.min_area) q = q.gte("area", args.min_area);
    if (args.unit_type) q = q.eq("unit_type", args.unit_type);
    const { data, error } = await q.order("price");
    if (error) return text({ error: error.message });
    return text(data);
  },
});

mcp.tool("stats_overview", {
  description:
    "إحصائيات سريعة: عدد الوحدات حسب الحالة، عدد الحجوزات، وإجمالي الإيراد السنوي المتوقع.",
  inputSchema: z.object({}),
  handler: async () => {
    const [units, bookings, buildings] = await Promise.all([
      admin.from("units").select("status,price,area"),
      admin.from("bookings").select("status,total_price,units_count"),
      admin.from("buildings").select("expected_annual_revenue"),
    ]);
    const byStatus: Record<string, number> = {};
    for (const u of units.data ?? [])
      byStatus[u.status] = (byStatus[u.status] ?? 0) + 1;
    const bookingsByStatus: Record<string, number> = {};
    for (const b of bookings.data ?? [])
      bookingsByStatus[b.status] = (bookingsByStatus[b.status] ?? 0) + 1;
    const expectedAnnual = (buildings.data ?? []).reduce(
      (s, b) => s + Number(b.expected_annual_revenue ?? 0),
      0,
    );
    return text({
      units_total: units.data?.length ?? 0,
      units_by_status: byStatus,
      bookings_total: bookings.data?.length ?? 0,
      bookings_by_status: bookingsByStatus,
      expected_annual_revenue: expectedAnnual,
    });
  },
});

mcp.tool("list_bookings", {
  description: "آخر الحجوزات. يمكن التصفية بالحالة.",
  inputSchema: z.object({
    status: z.enum(["pending", "confirmed", "cancelled", "expired"]).optional(),
    limit: z.number().optional(),
  }),
  handler: async (args) => {
    let q = admin
      .from("bookings")
      .select(
        "id,customer_full_name,customer_phone,status,total_price,units_count,expires_at,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(args.limit ?? 50);
    if (args.status) q = q.eq("status", args.status);
    const { data, error } = await q;
    if (error) return text({ error: error.message });
    return text(data);
  },
});

mcp.tool("get_booking", {
  description: "تفاصيل حجز معيّن مع الوحدات المرتبطة به.",
  inputSchema: z.object({ id: z.string() }),
  handler: async (args) => {
    const { data: booking, error } = await admin
      .from("bookings")
      .select("*")
      .eq("id", args.id)
      .maybeSingle();
    if (error) return text({ error: error.message });
    if (!booking) return text({ error: "not_found" });
    const { data: bunits } = await admin
      .from("booking_units")
      .select("*")
      .eq("booking_id", args.id);
    return text({ ...booking, units: bunits ?? [] });
  },
});

// ---------- HTTP transport ----------

const transport = new StreamableHttpTransport();
const handler = transport.bind(mcp);

const app = new Hono();

app.options("/*", () => new Response("ok", { headers: corsHeaders }));

app.get("/mcp/health", () =>
  new Response(
    JSON.stringify({ ok: true, name: "mnicejar-mcp", version: "1.0.0" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  ),
);

app.all("/*", async (c) => {
  const auth = await verifyApiKey(c.req.raw);
  if (!auth) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized: missing or invalid X-API-Key header",
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const res = await handler(c.req.raw);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
});

Deno.serve(app.fetch);
