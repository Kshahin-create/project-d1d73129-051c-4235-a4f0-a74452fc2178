// Send OTP via ZeptoMail
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ZEPTO_TOKEN = Deno.env.get("ZEPTOMAIL_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FROM_EMAIL = "noreply@mnicity.com";
const FROM_NAME = "MNI City";
const OTP_TTL_MINUTES = 10;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function genCode(): string {
  // 6-digit numeric
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return n.toString().padStart(6, "0");
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 255;
}

function emailHtml(code: string): string {
  return `<!doctype html>
<html dir="rtl" lang="ar">
  <body style="margin:0;padding:0;background:#f5f6f8;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f6f8;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,.06);">
          <tr>
            <td style="padding:28px 28px 8px 28px;text-align:center;">
              <div style="font-size:20px;font-weight:800;color:#0f172a;">${FROM_NAME}</div>
              <div style="font-size:13px;color:#64748b;margin-top:4px;">رمز التحقق الخاص بك</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 0 28px;">
              <p style="font-size:15px;line-height:1.7;color:#334155;margin:16px 0 8px;">
                مرحباً، استخدم الرمز التالي لإكمال عملية تسجيل الدخول. الرمز صالح لمدة ${OTP_TTL_MINUTES} دقائق.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 28px;">
              <div style="display:inline-block;letter-spacing:10px;font-size:32px;font-weight:800;color:#0f172a;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;padding:16px 24px;direction:ltr;">
                ${code}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px 28px;">
              <p style="font-size:13px;color:#64748b;line-height:1.7;margin:8px 0 0;">
                إذا لم تكن قد طلبت هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:14px 28px;text-align:center;font-size:12px;color:#94a3b8;">
              © ${new Date().getFullYear()} ${FROM_NAME}
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { email, purpose } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string" || !isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "بريد غير صالح" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const purposeVal =
      purpose === "signup" || purpose === "login" ? purpose : "login";
    const normalized = email.trim().toLowerCase();

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Rate limit: max 3 active codes per email per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("email_otps")
      .select("id", { count: "exact", head: true })
      .eq("email", normalized)
      .gte("created_at", oneHourAgo);
    if ((count ?? 0) >= 5) {
      return new Response(
        JSON.stringify({
          error: "تم تجاوز عدد المحاولات. حاول لاحقاً.",
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const code = genCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(
      Date.now() + OTP_TTL_MINUTES * 60 * 1000,
    ).toISOString();

    // Invalidate previous unused codes
    await supabase
      .from("email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("email", normalized)
      .is("consumed_at", null);

    const { error: insertErr } = await supabase.from("email_otps").insert({
      email: normalized,
      code_hash: codeHash,
      purpose: purposeVal,
      expires_at: expiresAt,
    });
    if (insertErr) throw insertErr;

    // Send via ZeptoMail
    const resp = await fetch("https://api.zeptomail.com/v1.1/email", {
      method: "POST",
      headers: {
        Authorization: `Zoho-enczapikey ${ZEPTO_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        from: { address: FROM_EMAIL, name: FROM_NAME },
        to: [{ email_address: { address: normalized } }],
        subject: `رمز التحقق: ${code}`,
        htmlbody: emailHtml(code),
        textbody: `رمز التحقق الخاص بك هو: ${code}\nالرمز صالح لمدة ${OTP_TTL_MINUTES} دقائق.`,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("ZeptoMail error", resp.status, txt);
      return new Response(
        JSON.stringify({ error: "تعذر إرسال البريد الإلكتروني" }),
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
    console.error("send-otp error", e);
    return new Response(JSON.stringify({ error: "خطأ غير متوقع" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
