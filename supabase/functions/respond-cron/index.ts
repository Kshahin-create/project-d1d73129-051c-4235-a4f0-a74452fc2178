// Auto-send WhatsApp reminders via respond.io for pending bookings.
// Schedule via pg_cron every ~15 minutes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESPOND_API = "https://api.respond.io/v2";
const CHANNEL_ID = 500762;

function normalizePhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("0") && d.length === 10) return "966" + d.slice(1);
  return d;
}

function buildTemplate(name: string, params: string[]) {
  const body = {
    type: "body",
    parameters: params.map((t) => ({ type: "text", text: String(t ?? "") })),
  };
  const components: any[] = [body];
  if (name === "offer_expiry_12h") components.push({ type: "footer", text: "شكرا لك." });
  return { name, languageCode: "ar", components };
}

async function sendTemplate(token: string, phone: string, name: string, params: string[]) {
  const to = normalizePhone(phone);
  if (!to) return { ok: false, error: "invalid phone" };
  const url = `${RESPOND_API}/contact/phone:${encodeURIComponent("+" + to)}/message`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      channelId: CHANNEL_ID,
      message: { type: "whatsapp_template", template: buildTemplate(name, params) },
    }),
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, body: text };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const TOKEN = Deno.env.get("RESPOND_IO_API_TOKEN");
    if (!TOKEN) throw new Error("RESPOND_IO_API_TOKEN missing");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get pending bookings expiring within ~13 hours that still need a reminder
    const now = Date.now();
    const horizon = new Date(now + 13 * 3600 * 1000).toISOString();
    const { data: rows, error } = await supabase
      .from("bookings")
      .select("id, customer_full_name, customer_phone, total_price, expires_at, reminder_12h_sent_at, reminder_4h_sent_at, booking_units(building_number,unit_number)")
      .eq("status", "pending")
      .lte("expires_at", horizon)
      .gt("expires_at", new Date(now).toISOString());

    if (error) throw error;

    const results: any[] = [];

    for (const b of rows || []) {
      const expMs = new Date(b.expires_at).getTime();
      const hoursLeft = (expMs - now) / 3600000;
      if (hoursLeft <= 0) continue;

      const units = ((b.booking_units as any[]) || []).map((u) => String(u.unit_number)).join(", ") || "—";
      const building = (b.booking_units as any[])?.[0]?.building_number ?? "—";
      const total = Number(b.total_price || 0).toLocaleString("en-US");
      const expiry = new Date(b.expires_at).toLocaleString("ar-EG-u-nu-latn", {
        dateStyle: "short", timeStyle: "short",
      });
      const params = [
        b.customer_full_name || "عميلنا",
        b.id.slice(0, 8),
        units,
        String(building),
        total,
        expiry,
      ];

      let template: "offer_expiry_12h" | "offer_expiry_4h" | null = null;
      let updateField: string | null = null;

      // Send 4h reminder first if applicable (window 3-5h, not yet sent)
      if (hoursLeft <= 5 && hoursLeft >= 2 && !b.reminder_4h_sent_at) {
        template = "offer_expiry_4h";
        updateField = "reminder_4h_sent_at";
      } else if (hoursLeft <= 13 && hoursLeft >= 10 && !b.reminder_12h_sent_at) {
        template = "offer_expiry_12h";
        updateField = "reminder_12h_sent_at";
      }

      if (!template || !updateField) continue;
      if (!b.customer_phone) {
        results.push({ id: b.id, skipped: "no phone" });
        continue;
      }

      const r = await sendTemplate(TOKEN, b.customer_phone, template, params);
      if (r.ok) {
        await supabase
          .from("bookings")
          .update({ [updateField]: new Date().toISOString() })
          .eq("id", b.id);
        results.push({ id: b.id, sent: template });
      } else {
        console.error("send failed", b.id, r);
        results.push({ id: b.id, error: r.body, status: r.status });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("respond-cron error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
