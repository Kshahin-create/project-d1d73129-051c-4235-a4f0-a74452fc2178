// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { isTrustedBackupCron,allowsBackupAction } from '../_shared/backup-security.ts';

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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ANON = Deno.env.get("SUPABASE_ANON_KEY");
    if(!SUPABASE_URL||!SERVICE_KEY||!ANON)return json({error:'تعذر الوصول للنسخ الاحتياطي'},500);

    const isCron = isTrustedBackupCron(Deno.env.get('BACKUP_CRON_SECRET'),req.headers.get('x-cron-secret'));

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    let userData: any = { user: null };

    if (!isCron) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace("Bearer ", "");
      if (!token) return json({ error: "Unauthorized" }, 401);

      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const got = await userClient.auth.getUser();
      if (got.error || !got.data.user) return json({ error: "Unauthorized" }, 401);
      userData = got.data;

      const permission=await userClient.rpc('has_permission',{_capability:'security.roles',_level:'edit'});
      if(permission.error||!permission.data)return json({error:'غير مسموح بإدارة النسخ الاحتياطي'},403);
    } else {
      userData = { user: { id: null, email: "cron@system" } };
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    if(!allowsBackupAction(action,isCron))return json({error:'الاستعادة بالحذف وحذف تاريخ النسخ متوقفان لحماية السجلات؛ المهام المجدولة تنشئ نسخة فقط'},403);

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
      const path = `${userData.user.id ?? "system"}/${Date.now()}-${name}.json`;

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

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
