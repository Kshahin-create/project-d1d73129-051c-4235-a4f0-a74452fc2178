// Verify OTP and create a Supabase session via magic-link generation
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

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 255;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { email, code, fullName, phone, businessName, activityType, notes } =
      await req.json().catch(() => ({}));

    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "بريد غير صالح" }), {
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

    const normalized = email.trim().toLowerCase();
    const codeHash = await sha256Hex(code);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Get latest active OTP for this email
    const { data: otps, error: fetchErr } = await supabase
      .from("email_otps")
      .select("*")
      .eq("email", normalized)
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
        .from("email_otps")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", otp.id);
      return new Response(
        JSON.stringify({ error: "انتهت صلاحية الرمز، أعد طلب الإرسال" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (otp.attempts >= 5) {
      await supabase
        .from("email_otps")
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
        .from("email_otps")
        .update({ attempts: otp.attempts + 1 })
        .eq("id", otp.id);
      return new Response(JSON.stringify({ error: "رمز غير صحيح" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark OTP as consumed
    await supabase
      .from("email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", otp.id);

    // Find or create user
    const { data: list } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    let user = list?.users.find(
      (u) => u.email?.toLowerCase() === normalized,
    );

    if (!user) {
      // Create new confirmed user
      const { data: created, error: createErr } =
        await supabase.auth.admin.createUser({
          email: normalized,
          email_confirm: true,
          user_metadata: {
            display_name: fullName || normalized,
          },
        });
      if (createErr) throw createErr;
      user = created.user!;

      // Save customer profile if signup data provided
      if (fullName || phone) {
        await supabase.from("customer_profiles").upsert(
          {
            user_id: user.id,
            full_name: (fullName || "").trim() || null,
            phone: (phone || "").trim() || null,
            email: normalized,
            business_name: (businessName || "").trim() || null,
            activity_type: (activityType || "").trim() || null,
            notes: (notes || "").trim() || null,
          },
          { onConflict: "user_id" },
        );
      }
    }

    // Generate a magiclink to extract tokens and return them to client
    const { data: linkData, error: linkErr } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: normalized,
      });
    if (linkErr) throw linkErr;

    const props: any = linkData?.properties ?? {};
    const hashedToken: string | undefined =
      props.hashed_token || props.email_otp || undefined;

    if (!hashedToken) {
      throw new Error("Could not generate session token");
    }

    return new Response(
      JSON.stringify({
        ok: true,
        verification_token: hashedToken,
        email: normalized,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("verify-otp error", e);
    return new Response(JSON.stringify({ error: "خطأ غير متوقع" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
