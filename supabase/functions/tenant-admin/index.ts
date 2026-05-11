// Admin endpoint for managing tenant accounts (create, set password, magic link)
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function randomToken(len = 32): string {
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin/manager
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    if (!roleSet.has("admin") && !roleSet.has("manager")) {
      return json({ error: "Not authorized" }, 403);
    }

    const body = await req.json();
    const action = body.action as string;

    if (action === "create") {
      const {
        full_name,
        email,
        phone,
        password,
        business_name,
        cr_number,
        notes,
        unit_ids,
      } = body;
      if (!full_name || !email || !password) {
        return json({ error: "full_name, email, password مطلوبة" }, 400);
      }
      // Create auth user
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        phone: phone || undefined,
        user_metadata: { display_name: full_name, is_tenant: true },
      });
      if (cErr || !created.user) return json({ error: cErr?.message || "فشل إنشاء الحساب" }, 400);

      const newUserId = created.user.id;
      // Replace default 'user' role with 'tenant'
      await admin.from("user_roles").delete().eq("user_id", newUserId);
      await admin.from("user_roles").insert({ user_id: newUserId, role: "tenant" });

      const { data: ta, error: taErr } = await admin
        .from("tenant_accounts")
        .insert({
          user_id: newUserId,
          full_name,
          email,
          phone: phone || null,
          business_name: business_name || null,
          cr_number: cr_number || null,
          notes: notes || null,
          created_by: userRes.user.id,
        })
        .select()
        .single();
      if (taErr) return json({ error: taErr.message }, 400);

      if (Array.isArray(unit_ids) && unit_ids.length > 0) {
        await admin
          .from("tenant_account_units")
          .insert(unit_ids.map((u: string) => ({ tenant_account_id: ta.id, unit_id: u })));
      }

      return json({ ok: true, tenant_account: ta });
    }

    if (action === "set_password") {
      const { tenant_account_id, password } = body;
      if (!tenant_account_id || !password || password.length < 6)
        return json({ error: "كلمة سر غير صالحة (6 أحرف على الأقل)" }, 400);
      const { data: ta } = await admin
        .from("tenant_accounts")
        .select("user_id")
        .eq("id", tenant_account_id)
        .single();
      if (!ta) return json({ error: "حساب غير موجود" }, 404);
      const { error } = await admin.auth.admin.updateUserById(ta.user_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "update_profile") {
      const { tenant_account_id, full_name, phone, email, business_name, notes } = body;
      if (!tenant_account_id) return json({ error: "tenant_account_id مطلوب" }, 400);
      const { data: ta } = await admin
        .from("tenant_accounts")
        .select("user_id")
        .eq("id", tenant_account_id)
        .single();
      if (!ta) return json({ error: "حساب غير موجود" }, 404);

      const updates: any = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (phone !== undefined) updates.phone = phone;
      if (email !== undefined) updates.email = email;
      if (business_name !== undefined) updates.business_name = business_name;
      if (notes !== undefined) updates.notes = notes;

      const { error } = await admin
        .from("tenant_accounts")
        .update(updates)
        .eq("id", tenant_account_id);
      if (error) return json({ error: error.message }, 400);

      // Sync auth email/phone if provided
      const authUpdates: any = {};
      if (email !== undefined) authUpdates.email = email;
      if (phone !== undefined) authUpdates.phone = phone;
      if (Object.keys(authUpdates).length > 0) {
        await admin.auth.admin.updateUserById(ta.user_id, authUpdates);
      }
      return json({ ok: true });
    }

    if (action === "magic_link") {
      const { tenant_account_id, hours } = body;
      const ttlHours = Math.min(Math.max(parseInt(hours) || 24, 1), 168);
      if (!tenant_account_id) return json({ error: "tenant_account_id مطلوب" }, 400);
      const { data: ta } = await admin
        .from("tenant_accounts")
        .select("id")
        .eq("id", tenant_account_id)
        .single();
      if (!ta) return json({ error: "حساب غير موجود" }, 404);

      const token = randomToken(32);
      const tokenHash = await sha256(token);
      const expires = new Date(Date.now() + ttlHours * 3600_000).toISOString();
      const { error } = await admin.from("tenant_login_links").insert({
        tenant_account_id,
        token_hash: tokenHash,
        expires_at: expires,
        created_by: userRes.user.id,
      });
      if (error) return json({ error: error.message }, 400);

      const origin = req.headers.get("origin") || "";
      const url = `${origin}/tenant-login/${token}`;
      return json({ ok: true, url, token, expires_at: expires });
    }

    if (action === "delete") {
      const { tenant_account_id } = body;
      const { data: ta } = await admin
        .from("tenant_accounts")
        .select("user_id")
        .eq("id", tenant_account_id)
        .single();
      if (!ta) return json({ error: "حساب غير موجود" }, 404);
      await admin.from("tenant_accounts").delete().eq("id", tenant_account_id);
      await admin.auth.admin.deleteUser(ta.user_id);
      return json({ ok: true });
    }

    return json({ error: "إجراء غير معروف" }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "خطأ غير متوقع" }, 500);
  }
});
