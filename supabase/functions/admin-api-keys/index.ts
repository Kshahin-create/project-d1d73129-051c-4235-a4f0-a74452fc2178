// Admin-only function to create / revoke API keys.
// Frontend calls this; the raw key is returned ONCE on creation and never stored in plain text.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

function generateKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "")
    .replace(/\//g, "")
    .replace(/=/g, "");
  return `nkb_live_${b64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = auth.slice(7);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: claims, error: ce } = await userClient.auth.getClaims(token);
  if (ce || !claims?.claims) return json({ error: "Unauthorized" }, 401);
  const userId = claims.claims.sub as string;
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (!(roles ?? []).some((r) => r.role === "admin"))
    return json({ error: "Admin only" }, 403);

  try {
    if (req.method === "POST") {
      const body = await req.json();
      const name = String(body?.name ?? "").trim();
      const scopes = Array.isArray(body?.scopes) ? body.scopes : ["read"];
      const expires_at = body?.expires_at ?? null;
      if (!name || name.length > 100)
        return json({ error: "name is required (max 100 chars)" }, 400);
      const validScopes = scopes.filter((s: string) =>
        ["read", "write", "admin"].includes(s),
      );
      if (validScopes.length === 0)
        return json({ error: "at least one valid scope required" }, 400);

      const rawKey = generateKey();
      const hash = await sha256Hex(rawKey);
      const { data, error } = await admin
        .from("api_keys")
        .insert({
          name,
          key_prefix: rawKey.slice(0, 16),
          key_hash: hash,
          scopes: validScopes,
          expires_at,
          created_by: userId,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ data: { ...data, raw_key: rawKey } }, 201);
    }
    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "id is required" }, 400);
      const { error } = await admin
        .from("api_keys")
        .update({ is_active: false })
        .eq("id", id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
