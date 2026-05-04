// Verify SMS OTP and:
//  - signup: create user with email-alias + password, store profile
//  - reset:  update existing user's password
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizePhone(raw: string): string | null {
  const trimmed = (raw || "").trim().replace(/[\s\-()]/g, "");
  if (!trimmed) return null;
  let p = trimmed;
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0") && p.length === 10) p = "966" + p.slice(1);
  if (!/^\d{8,15}$/.test(p)) return null;
  return p;
}

// Email alias used for phone-based accounts. Must be a valid email format.
function phoneToEmail(phone: string): string {
  return `${phone}@phone.mnicity.app`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const {
      phone,
      code,
      password,
      purpose,
      fullName,
      email,
      businessName,
      activityType,
      notes,
    } = await req.json().catch(() => ({}));

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return new Response(JSON.stringify({ error: "رقم جوال غير صالح" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!code || typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: "رمز غير صالح" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return new Response(
        JSON.stringify({ error: "كلمة المرور يجب ألا تقل عن 8 أحرف" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const purposeVal: "signup" | "reset" =
      purpose === "reset" ? "reset" : "signup";

    const codeHash = await sha256Hex(code);
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: otps, error: fetchErr } = await supabase
      .from("phone_otps")
      .select("*")
      .eq("phone", normalized)
      .eq("purpose", purposeVal)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (fetchErr) throw fetchErr;
    const otp = otps?.[0];
    if (!otp) {
      return new Response(
        JSON.stringify({ error: "لا يوجد رمز نشط، أعد طلب الإرسال" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      await supabase
        .from("phone_otps")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", otp.id);
      return new Response(
        JSON.stringify({ error: "انتهت صلاحية الرمز، أعد الطلب" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (otp.attempts >= 5) {
      await supabase
        .from("phone_otps")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", otp.id);
      return new Response(
        JSON.stringify({ error: "تم تجاوز عدد المحاولات" }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (otp.code_hash !== codeHash) {
      await supabase
        .from("phone_otps")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id);
      return new Response(JSON.stringify({ error: "رمز غير صحيح" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark consumed
    await supabase
      .from("phone_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", otp.id);

    const aliasEmail = phoneToEmail(normalized);
    const userEmail = (email && typeof email === "string" && email.includes("@"))
      ? email.trim().toLowerCase()
      : aliasEmail;

    if (purposeVal === "signup") {
      // Reject if a profile already exists with this phone
      const { data: existingProfile } = await supabase
        .from("customer_profiles")
        .select("user_id")
        .eq("phone", normalized)
        .maybeSingle();
      if (existingProfile?.user_id) {
        return new Response(
          JSON.stringify({ error: "هذا الرقم مسجل مسبقاً، استخدم تسجيل الدخول" }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data: created, error: createErr } =
        await supabase.auth.admin.createUser({
          email: userEmail,
          password,
          email_confirm: true,
          phone: normalized,
          user_metadata: {
            display_name: (fullName || normalized).toString(),
            phone: normalized,
          },
        });
      if (createErr) throw createErr;
      const user = created.user!;

      await supabase.from("customer_profiles").upsert(
        {
          user_id: user.id,
          full_name: (fullName || "").toString().trim() || null,
          phone: normalized,
          email: userEmail,
          business_name: (businessName || "").toString().trim() || null,
          activity_type: (activityType || "").toString().trim() || null,
          notes: (notes || "").toString().trim() || null,
        },
        { onConflict: "user_id" },
      );

      return new Response(
        JSON.stringify({ ok: true, login_email: userEmail }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // reset path
    const { data: prof } = await supabase
      .from("customer_profiles")
      .select("user_id, email")
      .eq("phone", normalized)
      .maybeSingle();
    if (!prof?.user_id) {
      return new Response(JSON.stringify({ error: "لا يوجد حساب بهذا الرقم" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updErr } = await supabase.auth.admin.updateUserById(
      prof.user_id,
      { password },
    );
    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({ ok: true, login_email: prof.email || aliasEmail }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("verify-sms-otp error", e);
    const msg = e instanceof Error ? e.message : "خطأ غير متوقع";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
