// Notify admins/managers on Telegram about a new interested customer (web/manual).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Require authenticated caller (user JWT or service_role).
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const bearer = authHeader.slice(7);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey,
    );

    if (bearer !== serviceKey) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: claims, error: cErr } = await userClient.auth.getClaims(bearer);
      if (cErr || !claims?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { interested } = await req.json();
    if (!interested?.id) {
      return new Response(JSON.stringify({ error: "Missing interested payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Validate the interested record actually exists to prevent spoofed notifications.
    const { data: existing, error: exErr } = await supabase
      .from("interested_customers")
      .select("id")
      .eq("id", interested.id)
      .maybeSingle();
    if (exErr || !existing) {
      return new Response(JSON.stringify({ error: "Interested record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const text =
      "🆕 <b>عميل مهتم جديد</b>\n\n" +
      `👤 ${esc(interested.full_name)}\n` +
      `📱 <code>${esc(interested.phone)}</code>\n` +
      (interested.requested_activity ? `🏷️ ${esc(interested.requested_activity)}\n` : "") +
      (interested.business_name ? `🏢 ${esc(interested.business_name)}\n` : "") +
      (interested.requested_building
        ? `🏗️ المبنى ${esc(String(interested.requested_building))}`
        : "") +
      (interested.requested_unit
        ? ` / وحدة ${esc(String(interested.requested_unit))}\n`
        : "\n") +
      (interested.customer_source ? `🎯 المصدر: ${esc(interested.customer_source)}\n` : "") +
      (interested.notes ? `📝 ${esc(interested.notes)}\n` : "") +
      `\n📥 المصدر: ${interested.source === "telegram" ? "تيليجرام" : interested.source === "web" ? "ويب" : "إدخال يدوي"}\n` +
      `#interested_${interested.id.slice(0, 8)}`;

    // Send to admin/manager subscribers, skipping the originating chat
    const { data: subs } = await supabase
      .from("telegram_subscribers")
      .select("chat_id, user_id")
      .not("user_id", "is", null);

    const chatIds = new Set<number>();
    if (subs) {
      // include only those with admin/manager role
      const userIds = [...new Set(subs.map((s: any) => s.user_id).filter(Boolean))];
      if (userIds.length) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", userIds);
        const allowed = new Set(
          (roles ?? [])
            .filter((r: any) => r.role === "admin" || r.role === "manager")
            .map((r: any) => r.user_id),
        );
        for (const s of subs as any[]) {
          if (allowed.has(s.user_id) && Number(s.chat_id) !== Number(interested.telegram_chat_id)) {
            chatIds.add(Number(s.chat_id));
          }
        }
      }
    }

    const results: any[] = [];
    for (const id of chatIds) {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: id,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
      results.push({ chat_id: id, ok: r.ok });
    }

    return new Response(JSON.stringify({ ok: true, sent: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
