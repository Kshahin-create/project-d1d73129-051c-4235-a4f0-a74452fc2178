// Issues a one-time token tied to current user's session, then 302-redirects to mobile app scheme.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") || "google";
    const next = url.searchParams.get("next") || "/dashboard";
    const redirectUri =
      url.searchParams.get("redirect_uri") || "ejar-auth://auth";

    // Auth: requires bearer token (access_token from Supabase)
    const authHeader = req.headers.get("Authorization") || "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // We need the refresh token too — pass it as ?refresh_token=... or header x-refresh-token
    const refreshToken =
      url.searchParams.get("refresh_token") ||
      req.headers.get("x-refresh-token") ||
      "";
    if (!refreshToken) {
      return new Response(JSON.stringify({ error: "Missing refresh_token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate session
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate token
    const rawToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await sha256(rawToken);

    const admin = createClient(supabaseUrl, serviceKey);
    const { error: insertErr } = await admin.from("one_time_tokens").insert({
      token_hash: tokenHash,
      user_id: userData.user.id,
      provider,
      next_path: next,
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (insertErr) {
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 302 to mobile scheme
    const target = `${redirectUri}?token=${encodeURIComponent(
      rawToken,
    )}&provider=${encodeURIComponent(provider)}&next=${encodeURIComponent(next)}`;

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: target },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
