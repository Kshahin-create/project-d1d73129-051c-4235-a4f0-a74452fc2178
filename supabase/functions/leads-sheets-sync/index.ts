// Sync leads with Google Sheets via the Lovable connector gateway
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY =
  "https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SHEETS_API_KEY = Deno.env.get("GOOGLE_SHEETS_API_KEY");

const STATUS_AR: Record<string, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  interested: "مهتم",
  not_interested: "غير مهتم",
  converted: "تحوّل لعميل",
};
const AR_STATUS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_AR).map(([k, v]) => [v, k]),
);

const HEADER = ["الاسم", "رقم الجوال", "ملاحظات", "الحالة", "آخر تواصل", "ID"];

function normalizePhone(raw: string) {
  const d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("0") && d.length === 10) return "966" + d.slice(1);
  return d;
}

async function gatewayFetch(path: string, init: RequestInit = {}) {
  if (!LOVABLE_API_KEY || !SHEETS_API_KEY) {
    throw new Error("Google Sheets connector not configured");
  }
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SHEETS_API_KEY,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Sheets API ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAdmin = (roles || []).some((r: { role: string }) =>
      r.role === "admin" || r.role === "manager"
    );
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "sync";

    const { data: settings } = await admin
      .from("app_settings")
      .select("leads_sheet_id, leads_sheet_name")
      .eq("id", 1)
      .maybeSingle();

    const sheetId = settings?.leads_sheet_id;
    const sheetName = settings?.leads_sheet_name || "Leads";
    if (!sheetId) throw new Error("لم يتم إعداد معرّف الشييت بعد");

    let pushed = 0;
    let pulled = 0;
    let updated = 0;
    let inserted = 0;

    // PUSH: leads -> sheet
    if (action === "push" || action === "sync") {
      const { data: leads } = await admin
        .from("leads")
        .select("id, full_name, phone, notes, status, last_message_at")
        .order("created_at", { ascending: false })
        .limit(5000);

      const rows = [HEADER].concat(
        (leads || []).map((l) => [
          l.full_name || "",
          l.phone || "",
          l.notes || "",
          STATUS_AR[l.status] || l.status || "",
          l.last_message_at
            ? new Date(l.last_message_at).toISOString().replace("T", " ").slice(0, 16)
            : "",
          l.id,
        ]),
      );
      pushed = rows.length - 1;

      // Clear then write
      await gatewayFetch(
        `/${sheetId}/values/${sheetName}!A:F:clear`,
        { method: "POST", body: "{}" },
      );
      await gatewayFetch(
        `/${sheetId}/values/${sheetName}!A1?valueInputOption=RAW`,
        { method: "PUT", body: JSON.stringify({ values: rows }) },
      );
    }

    // PULL: sheet -> leads
    if (action === "pull") {
      const result = await gatewayFetch(`/${sheetId}/values/${sheetName}!A2:F`);
      const values: string[][] = result.values || [];
      pulled = values.length;

      for (const row of values) {
        const name = (row[0] || "").trim();
        const phoneRaw = (row[1] || "").trim();
        const notes = (row[2] || "").trim() || null;
        const statusAr = (row[3] || "").trim();
        const id = (row[5] || "").trim();
        if (!name || !phoneRaw) continue;
        const digits = normalizePhone(phoneRaw);
        const phone = phoneRaw.startsWith("+") ? phoneRaw : digits ? "+" + digits : phoneRaw;
        const status = AR_STATUS[statusAr] || (statusAr || "new");

        if (id) {
          const { error } = await admin
            .from("leads")
            .update({ full_name: name, phone, notes, status })
            .eq("id", id);
          if (!error) updated++;
        } else {
          // Match by phone, else insert
          const { data: existing } = await admin
            .from("leads")
            .select("id")
            .eq("phone", phone)
            .maybeSingle();
          if (existing?.id) {
            const { error } = await admin
              .from("leads")
              .update({ full_name: name, notes, status })
              .eq("id", existing.id);
            if (!error) updated++;
          } else {
            const { error } = await admin
              .from("leads")
              .insert({ full_name: name, phone, notes, status });
            if (!error) inserted++;
          }
        }
      }
    }

    await admin
      .from("app_settings")
      .update({ leads_sheet_last_sync_at: new Date().toISOString() })
      .eq("id", 1);

    return new Response(
      JSON.stringify({ ok: true, pushed, pulled, inserted, updated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
