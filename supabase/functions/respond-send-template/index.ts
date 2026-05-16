// Send WhatsApp templates via respond.io
// Supports: offer_expiry_12h, offer_expiry_4h, booking_confirmed
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESPOND_API = "https://api.respond.io/v2";
const CHANNEL_ID = 500762;

type TemplateName = "offer_expiry_12h" | "offer_expiry_4h" | "booking_confirmed";

const ALLOWED: TemplateName[] = ["offer_expiry_12h", "offer_expiry_4h", "booking_confirmed"];

function normalizePhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("0") && d.length === 10) return "966" + d.slice(1);
  return d;
}

function buildTemplate(name: TemplateName, params: string[]) {
  const body = {
    type: "body",
    parameters: params.map((t) => ({ type: "text", text: String(t ?? "") })),
  };
  if (name === "booking_confirmed") {
    return {
      name,
      languageCode: "ar",
      components: [body, { type: "buttons", buttons: [{ type: "quick_reply", text: "تمام" }] }],
    };
  }
  const components: any[] = [body];
  if (name === "offer_expiry_12h") components.push({ type: "footer", text: "شكرا لك." });
  return { name, languageCode: "ar", components };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ⛔ متوقف مؤقتاً: كل رسائل واتساب موقوفة بناءً على طلب المستخدم
  return new Response(
    JSON.stringify({ ok: true, disabled: true, message: "WhatsApp sending is temporarily disabled" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );

  try {
    const TOKEN = Deno.env.get("RESPOND_IO_API_TOKEN");
    if (!TOKEN) throw new Error("RESPOND_IO_API_TOKEN missing");

    // Auth — admin/manager only
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id);
    const allowed = (roles || []).some((r: any) => r.role === "admin" || r.role === "manager");
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { template, phone, params } = body as {
      template: TemplateName; phone: string; params: string[];
    };

    if (!ALLOWED.includes(template)) {
      return new Response(JSON.stringify({ error: "Unsupported template" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const to = normalizePhone(phone);
    if (!to) {
      return new Response(JSON.stringify({ error: "Invalid phone" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(params) || params.length !== 6) {
      return new Response(JSON.stringify({ error: "params must be 6 strings" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      channelId: CHANNEL_ID,
      message: { type: "whatsapp_template", template: buildTemplate(template, params) },
    };

    // respond.io contact message endpoint
    const url = `${RESPOND_API}/contact/phone:${encodeURIComponent("+" + to)}/message`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    if (!r.ok) {
      console.error("respond.io error", r.status, text);
      return new Response(JSON.stringify({ error: "respond.io failed", status: r.status, detail: text }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, response: safeJson(text) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("respond-send-template error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function safeJson(t: string) { try { return JSON.parse(t); } catch { return t; } }
