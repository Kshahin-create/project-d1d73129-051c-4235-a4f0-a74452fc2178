// MFA SMS Recovery — sends OTP via OurSMS to user's saved phone, verifies, then unenrolls TOTP factors using service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OURSMS_API_KEY = Deno.env.get("OURSMS_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SMS_SRC = "RAWZ OTP";
const OTP_TTL_MINUTES = 10;
const PURPOSE = "mfa_recovery";

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function genCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return n.toString().padStart(6, "0");
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

async function getUserFromAuth(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data } = await sb.auth.getUser(token);
  return data?.user ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await getUserFromAuth(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action: "send" | "verify" = body?.action === "verify" ? "verify" : "send";

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Get user phone from auth.users
    const { data: u2 } = await admin.auth.admin.getUserById(user.id);
    const phoneRaw = u2?.user?.phone || "";
    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      return new Response(JSON.stringify({ error: "لا يوجد رقم جوال مسجّل في حسابك" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send") {
      // Rate limit: max 3 per hour
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await admin.from("phone_otps")
        .select("id", { count: "exact", head: true })
        .eq("phone", phone).eq("purpose", PURPOSE).gte("created_at", since);
      if ((count ?? 0) >= 3) {
        return new Response(JSON.stringify({ error: "تجاوزت عدد المحاولات. حاول بعد ساعة." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const code = genCode();
      const codeHash = await sha256Hex(code);
      const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

      await admin.from("phone_otps")
        .update({ consumed_at: new Date().toISOString() })
        .eq("phone", phone).eq("purpose", PURPOSE).is("consumed_at", null);

      const { error: insErr } = await admin.from("phone_otps").insert({
        phone, code_hash: codeHash, purpose: PURPOSE, expires_at: expiresAt,
      });
      if (insErr) throw insErr;

      const smsBody = `رمز تعطيل التحقق بخطوتين هو ${code}`;
      const resp = await fetch("https://api.oursms.com/msgs/sms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OURSMS_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          src: SMS_SRC, dests: [phone], body: smsBody,
          msgClass: "transactional", priority: 1, secure: true,
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        console.error("OurSMS error", resp.status, txt);
        return new Response(JSON.stringify({ error: "تعذر إرسال الرسالة" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mask phone
      const masked = phone.replace(/(\d{3})\d+(\d{3})/, "$1****$2");
      return new Response(JSON.stringify({ ok: true, phone_masked: masked, expires_in: OTP_TTL_MINUTES * 60 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // action === verify
    const code = String(body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: "أدخل رمزًا مكوّنًا من 6 أرقام" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const codeHash = await sha256Hex(code);
    const { data: otpRow } = await admin.from("phone_otps")
      .select("id, expires_at, attempts, consumed_at, code_hash")
      .eq("phone", phone).eq("purpose", PURPOSE)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();

    if (!otpRow) {
      return new Response(JSON.stringify({ error: "لا يوجد طلب نشط. اطلب رمزًا جديدًا." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "انتهت صلاحية الرمز. اطلب رمزًا جديدًا." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if ((otpRow.attempts ?? 0) >= 5) {
      return new Response(JSON.stringify({ error: "تم تجاوز عدد المحاولات." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (otpRow.code_hash !== codeHash) {
      await admin.from("phone_otps").update({ attempts: (otpRow.attempts ?? 0) + 1 }).eq("id", otpRow.id);
      return new Response(JSON.stringify({ error: "رمز غير صحيح" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark consumed and unenroll all MFA factors for the user
    await admin.from("phone_otps").update({ consumed_at: new Date().toISOString() }).eq("id", otpRow.id);

    const { data: factorsList, error: lfErr } = await (admin as any).auth.admin.mfa.listFactors({ userId: user.id });
    if (lfErr) {
      console.error("listFactors err", lfErr);
    }
    const all = factorsList?.factors ?? [];
    let removed = 0;
    for (const f of all) {
      const { error: delErr } = await (admin as any).auth.admin.mfa.deleteFactor({ userId: user.id, id: f.id });
      if (!delErr) removed++;
      else console.error("deleteFactor err", delErr);
    }

    return new Response(JSON.stringify({ ok: true, removed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("mfa-sms-recovery error", e);
    return new Response(JSON.stringify({ error: "خطأ غير متوقع" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
