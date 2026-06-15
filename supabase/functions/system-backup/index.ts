// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Order matters for restore: parents before children
const TABLES = [
  "buildings",
  "profiles",
  "user_roles",
  "app_settings",
  "units",
  "customer_profiles",
  "leads",
  "tenant_accounts",
  "bookings",
  "booking_units",
  "tenants",
  "tenant_account_units",
  "invoices",
  "unit_audit_log",
  "audit_log",
  "telegram_subscribers",
  "suppressed_emails",
  "email_send_log",
  "system_backups",
];

const BUCKET = "system-backups";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    // has_role checks auth.uid() so call directly:
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "create") {
      const name = (body.name as string) || `backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
      const notes = (body.notes as string) ?? null;
      const data: Record<string, any[]> = {};
      const counts: Record<string, number> = {};

      for (const t of TABLES) {
        const rows: any[] = [];
        let from = 0;
        const PAGE = 1000;
        // paginate
        // deno-lint-ignore no-constant-condition
        while (true) {
          const { data: page, error } = await admin.from(t).select("*").range(from, from + PAGE - 1);
          if (error) { console.error("read", t, error.message); break; }
          rows.push(...(page ?? []));
          if (!page || page.length < PAGE) break;
          from += PAGE;
        }
        data[t] = rows;
        counts[t] = rows.length;
      }

      const payload = {
        version: 1,
        created_at: new Date().toISOString(),
        created_by: userData.user.email,
        tables: TABLES,
        data,
      };
      const json_str = JSON.stringify(payload);
      const bytes = new TextEncoder().encode(json_str);
      const path = `${userData.user.id}/${Date.now()}-${name}.json`;

      const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
        contentType: "application/json",
        upsert: false,
      });
      if (upErr) return json({ error: upErr.message }, 500);

      const { data: rec, error: insErr } = await admin
        .from("system_backups")
        .insert({
          name,
          storage_path: path,
          size_bytes: bytes.length,
          table_counts: counts,
          kind: (body.kind as string) || "manual",
          notes,
          created_by: userData.user.id,
        })
        .select()
        .single();
      if (insErr) return json({ error: insErr.message }, 500);

      return json({ ok: true, backup: rec });
    }

    if (action === "list") {
      const { data, error } = await admin
        .from("system_backups")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, backups: data });
    }

    if (action === "download") {
      const id = body.id as string;
      const { data: rec, error } = await admin.from("system_backups").select("*").eq("id", id).single();
      if (error || !rec) return json({ error: "Not found" }, 404);
      const { data: signed, error: sErr } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(rec.storage_path, 300);
      if (sErr) return json({ error: sErr.message }, 500);
      return json({ ok: true, url: signed.signedUrl });
    }

    if (action === "delete") {
      const id = body.id as string;
      const { data: rec, error } = await admin.from("system_backups").select("*").eq("id", id).single();
      if (error || !rec) return json({ error: "Not found" }, 404);
      await admin.storage.from(BUCKET).remove([rec.storage_path]);
      await admin.from("system_backups").delete().eq("id", id);
      return json({ ok: true });
    }

    if (action === "restore") {
      const id = body.id as string;
      const { data: rec, error } = await admin.from("system_backups").select("*").eq("id", id).single();
      if (error || !rec) return json({ error: "Not found" }, 404);
      const { data: file, error: dErr } = await admin.storage.from(BUCKET).download(rec.storage_path);
      if (dErr || !file) return json({ error: dErr?.message || "download failed" }, 500);
      const text = await file.text();
      const payload = JSON.parse(text);
      const data: Record<string, any[]> = payload.data || {};

      // Snapshot current state first (auto-backup before restore)
      try {
        await fetch(req.url, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", name: `pre-restore-${Date.now()}`, kind: "auto", notes: `auto before restore of ${rec.name}` }),
        });
      } catch (_) { /* ignore */ }

      const restoreOrder = TABLES.filter((t) => t !== "system_backups");
      const deleteOrder = [...restoreOrder].reverse();
      const report: Record<string, { deleted: number; inserted: number; error?: string }> = {};

      // Delete children first
      for (const t of deleteOrder) {
        const { error: delErr, count } = await admin.from(t).delete({ count: "exact" }).not("id", "is", null);
        report[t] = { deleted: count ?? 0, inserted: 0, error: delErr?.message };
      }
      // Insert parents first
      for (const t of restoreOrder) {
        const rows = data[t] ?? [];
        if (rows.length === 0) continue;
        // chunk inserts
        const CHUNK = 500;
        let inserted = 0;
        let lastErr: string | undefined;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const slice = rows.slice(i, i + CHUNK);
          const { error: insErr } = await admin.from(t).insert(slice);
          if (insErr) { lastErr = insErr.message; break; }
          inserted += slice.length;
        }
        report[t] = { ...(report[t] ?? { deleted: 0, inserted: 0 }), inserted, error: lastErr ?? report[t]?.error };
      }

      return json({ ok: true, report });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
