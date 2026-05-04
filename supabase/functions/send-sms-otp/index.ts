// Send OTP via SMS using OurSMS (Saudi Arabia)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OURSMS_API_KEY = Deno.env.get("OURSMS_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SMS_SRC = "RAWZ OTP"; // Sender ID — must be approved in OurSMS dashboard
const OTP_TTL_MINUTES = 10;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function genCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return n.toString().padStart(6, "0");
}

// Normalize to international format without "+", e.g. 9665XXXXXXXX
function normalizePhone(raw: string): string | null {
  const trimmed = (raw || "").trim().replace(/[\s\-()]/g, "");
  if (!trimmed) return null;
  // Accept "+9665..." or "9665..." or "05..." (assume KSA)
  let p = trimmed;
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0") && p.length === 10) p = "966" + p.slice(1);
  if (!/^\d{8,15}$/.test(p)) return null;
  return p;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { phone, purpose } = await req.json().catch(() => ({}));
    const normalized = normalizePhone(phone);
    if (!normalized) {
      return new Response(JSON.stringify({ error: "رقم جوال غير صالح" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const purposeVal: "signup" | "reset" =
      purpose === "reset" ? "reset" : "signup";

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Rate limits:
    // - signup: max 3 per hour per phone
    // - reset:  max 2 per 3 hours per phone
    const windowMs = purposeVal === "reset" ? 3 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const maxSends = purposeVal === "reset" ? 2 : 3;
    const since = new Date(Date.now() - windowMs).toISOString();
    const { count } = await supabase
      .from("phone_otps")
      .select("id", { count: "exact", head: true })
      .eq("phone", normalized)
      .eq("purpose", purposeVal)
      .gte("created_at", since);

    if ((count ?? 0) >= maxSends) {
      const hours = purposeVal === "reset" ? 3 : 1;
      return new Response(
        JSON.stringify({
          error: `تم تجاوز عدد المحاولات المسموح بها. حاول مجدداً بعد ${hours} ساعة.`,
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // For reset: ensure account exists
    if (purposeVal === "reset") {
      const { data: prof } = await supabase
        .from("customer_profiles")
        .select("user_id")
        .eq("phone", normalized)
        .maybeSingle();
      if (!prof?.user_id) {
        // Don't reveal account existence — but we need user to know
        return new Response(
          JSON.stringify({ error: "لا يوجد حساب بهذا الرقم" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const code = genCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(
      Date.now() + OTP_TTL_MINUTES * 60 * 1000,
    ).toISOString();

    // Invalidate previous unused codes for this phone+purpose
    await supabase
      .from("phone_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("phone", normalized)
      .eq("purpose", purposeVal)
      .is("consumed_at", null);

    const { error: insertErr } = await supabase.from("phone_otps").insert({
      phone: normalized,
      code_hash: codeHash,
      purpose: purposeVal,
      expires_at: expiresAt,
    });
    if (insertErr) throw insertErr;

    // Send via OurSMS
    const body = `رمز التحقق الخاص بك في MNI City: ${code}\nصالح لمدة ${OTP_TTL_MINUTES} دقائق.`;
    const resp = await fetch("https://api.oursms.com/msgs/sms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OURSMS_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        src: SMS_SRC,
        dests: [normalized],
        body,
        msgClass: "transactional",
        priority: 1,
        secure: true,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("OurSMS error", resp.status, txt);
      return new Response(
        JSON.stringify({ error: "تعذر إرسال الرسالة" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, expires_in: OTP_TTL_MINUTES * 60 }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("send-sms-otp error", e);
    return new Response(JSON.stringify({ error: "خطأ غير متوقع" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
