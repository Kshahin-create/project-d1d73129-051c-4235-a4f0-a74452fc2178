// Admin-only stats aggregator: server health, sign-ins, emails, bookings, units.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PROJECT_REF = (SUPABASE_URL.match(/https:\/\/([^.]+)\./) ?? [])[1];
const MGMT_TOKEN = Deno.env.get("SUPABASE_MGMT_TOKEN"); // optional

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(s),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function isAdminFromRequest(req: Request): Promise<boolean> {
  // API key path
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const hash = await sha256Hex(apiKey);
    const { data } = await admin.rpc("verify_api_key", { _key_hash: hash });
    if (data && data.length > 0 && data[0].is_valid) {
      return (data[0].scopes ?? []).includes("admin") || (data[0].scopes ?? []).includes("read");
    }
    return false;
  }
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: claims, error } = await userClient.auth.getClaims(token);
  if (error || !claims?.claims) return false;
  const userId = claims.claims.sub as string;
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return (roles ?? []).some((r) => r.role === "admin");
}

interface Bucket {
  ts: string;
  count: number;
}

function bucketByDay(rows: { created_at: string }[], days: number): Bucket[] {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const k = d.toISOString().slice(0, 10);
    buckets.set(k, 0);
  }
  for (const r of rows) {
    const k = (r.created_at ?? "").slice(0, 10);
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  return Array.from(buckets.entries()).map(([ts, count]) => ({ ts, count }));
}

async function fetchAuthSignIns(days: number) {
  // Try management API analytics for accurate auth log signal; fall back to profiles.created_at counts
  if (MGMT_TOKEN && PROJECT_REF) {
    try {
      const sql = `select timestamp from auth_logs cross join unnest(metadata) as m where m.path = '/token' and m.status = 200 and timestamp > timestamp_sub(current_timestamp(), interval ${days} day) limit 5000`;
      const r = await fetch(
        `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}`,
        { headers: { Authorization: `Bearer ${MGMT_TOKEN}` } },
      );
      if (r.ok) {
        const j = await r.json();
        const rows = (j?.result ?? []).map((x: any) => ({
          created_at: new Date(Number(x.timestamp) / 1000).toISOString(),
        }));
        return { total: rows.length, series: bucketByDay(rows, days), source: "auth_logs" };
      }
    } catch (_) { /* ignore */ }
  }
  // Fallback: profile creation as proxy for new sign-ups
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const { data } = await admin
    .from("profiles")
    .select("created_at")
    .gte("created_at", since.toISOString());
  const rows = (data ?? []).map((p) => ({ created_at: p.created_at }));
  return { total: rows.length, series: bucketByDay(rows, days), source: "profiles" };
}

async function fetchEmailStats(days: number) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const { data } = await admin
    .from("email_send_log")
    .select("message_id, status, template_name, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);
  const rows = data ?? [];
  // Dedup by message_id (latest first via order DESC, take first occurrence)
  const seen = new Set<string>();
  const latest: typeof rows = [];
  for (const r of rows) {
    const key = r.message_id ?? `${r.template_name}-${r.created_at}-${Math.random()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push(r);
  }
  const counts = { total: latest.length, sent: 0, failed: 0, suppressed: 0, pending: 0 };
  const byTemplate = new Map<string, number>();
  for (const r of latest) {
    if (r.status === "sent") counts.sent++;
    else if (r.status === "dlq" || r.status === "failed" || r.status === "bounced") counts.failed++;
    else if (r.status === "suppressed" || r.status === "complained") counts.suppressed++;
    else if (r.status === "pending") counts.pending++;
    byTemplate.set(r.template_name, (byTemplate.get(r.template_name) ?? 0) + 1);
  }
  const series = bucketByDay(
    latest.map((r) => ({ created_at: r.created_at })),
    days,
  );
  const topTemplates = Array.from(byTemplate.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  return { ...counts, series, topTemplates };
}

async function fetchBookingStats(days: number) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const { data } = await admin
    .from("bookings")
    .select("created_at, status, total_price, units_count")
    .gte("created_at", since.toISOString())
    .limit(5000);
  const rows = data ?? [];
  const total = rows.length;
  const totalRevenue = rows.reduce((s, r) => s + Number(r.total_price ?? 0), 0);
  const totalUnits = rows.reduce((s, r) => s + Number(r.units_count ?? 0), 0);
  const series = bucketByDay(
    rows.map((r) => ({ created_at: r.created_at })),
    days,
  );
  return { total, totalRevenue, totalUnits, series };
}

async function fetchUserStats() {
  const { count: usersCount } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true });
  const { data: roleRows } = await admin.from("user_roles").select("role");
  const roleCounts: Record<string, number> = {};
  for (const r of roleRows ?? []) {
    roleCounts[r.role] = (roleCounts[r.role] ?? 0) + 1;
  }
  return { total: usersCount ?? 0, roles: roleCounts };
}

async function fetchUnitStats() {
  const { data: units } = await admin
    .from("units")
    .select("status, price")
    .limit(5000);
  const u = units ?? [];
  const total = u.length;
  const rented = u.filter((x) => x.status === "rented").length;
  const reserved = u.filter((x) => x.status === "reserved").length;
  const available = total - rented - reserved;
  const actualRevenue = u
    .filter((x) => x.status === "rented")
    .reduce((s, x) => s + Number(x.price), 0);
  const potentialRevenue = u.reduce((s, x) => s + Number(x.price), 0);
  return {
    total,
    rented,
    reserved,
    available,
    occupancy_rate: total > 0 ? +((rented / total) * 100).toFixed(2) : 0,
    actualRevenue,
    potentialRevenue,
  };
}

async function fetchApiKeyStats() {
  const { data } = await admin
    .from("api_keys")
    .select("is_active, last_used_at");
  const total = (data ?? []).length;
  const active = (data ?? []).filter((k) => k.is_active).length;
  const usedLast24h = (data ?? []).filter(
    (k) =>
      k.last_used_at &&
      new Date(k.last_used_at).getTime() > Date.now() - 24 * 3600 * 1000,
  ).length;
  return { total, active, usedLast24h };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }
  const ok = await isAdminFromRequest(req);
  if (!ok) return json({ error: "Forbidden — admin only" }, 403);

  const url = new URL(req.url);
  const daysRaw = Number(url.searchParams.get("days") ?? "7");
  const days = Math.min(Math.max(1, isNaN(daysRaw) ? 7 : daysRaw), 90);

  try {
    const [signins, emails, bookings, users, units, apiKeys] = await Promise.all([
      fetchAuthSignIns(days),
      fetchEmailStats(days),
      fetchBookingStats(days),
      fetchUserStats(),
      fetchUnitStats(),
      fetchApiKeyStats(),
    ]);

    return json({
      generated_at: new Date().toISOString(),
      range_days: days,
      server: {
        status: "healthy",
        project_ref: PROJECT_REF,
      },
      signins,
      emails,
      bookings,
      users,
      units,
      api_keys: apiKeys,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("admin-stats error:", msg);
    return json({ error: msg }, 500);
  }
});
