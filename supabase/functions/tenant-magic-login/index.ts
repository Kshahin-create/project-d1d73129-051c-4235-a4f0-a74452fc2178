// Consume a tenant magic-link token; sets a temporary password & returns session
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

function tempPassword(): string {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return "Lk!" + Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { token } = await req.json();
    if (!token) return json({ error: "token مفقود" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE);

    const tokenHash = await sha256(token);
    const { data: link } = await admin
      .from("tenant_login_links")
      .select("id, tenant_account_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!link) return json({ error: "رابط غير صالح" }, 400);
    if (link.used_at) return json({ error: "الرابط مستخدم مسبقاً" }, 400);
    if (new Date(link.expires_at) < new Date()) return json({ error: "الرابط منتهي" }, 400);

    const { data: ta } = await admin
      .from("tenant_accounts")
      .select("user_id, email")
      .eq("id", link.tenant_account_id)
      .single();
    if (!ta?.email) return json({ error: "حساب بدون إيميل" }, 400);

    // Set temp password
    const tmp = tempPassword();
    const { error: pErr } = await admin.auth.admin.updateUserById(ta.user_id, { password: tmp });
    if (pErr) return json({ error: pErr.message }, 500);

    // Mark link used
    await admin.from("tenant_login_links").update({ used_at: new Date().toISOString() }).eq("id", link.id);

    // Sign in
    const userClient = createClient(SUPABASE_URL, ANON);
    const { data: sess, error: sErr } = await userClient.auth.signInWithPassword({
      email: ta.email,
      password: tmp,
    });
    if (sErr || !sess.session) return json({ error: sErr?.message || "فشل الدخول" }, 500);

    return json({
      ok: true,
      access_token: sess.session.access_token,
      refresh_token: sess.session.refresh_token,
    });
  } catch (e: any) {
    return json({ error: e?.message || "خطأ" }, 500);
  }
});
