// Records login / signup access events with IP + geo info.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    null
  );
}

async function geo(ip: string | null) {
  if (!ip) return {};
  try {
    const r = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp`,
    );
    const j = await r.json();
    if (j?.status !== "success") return {};
    return {
      country: j.country ?? null,
      region: j.regionName ?? null,
      city: j.city ?? null,
      isp: j.isp ?? null,
    };
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const event = String(body.event || "unknown").slice(0, 40);
    const ip = clientIp(req);
    const g = await geo(ip);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    await admin.from("access_log").insert({
      user_id: body.user_id || null,
      phone: body.phone ? String(body.phone).slice(0, 30) : null,
      email: body.email ? String(body.email).slice(0, 200) : null,
      event,
      ip_address: ip,
      user_agent: (req.headers.get("user-agent") || "").slice(0, 500),
      path: body.path ? String(body.path).slice(0, 200) : null,
      ...g,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("log-access error", e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
