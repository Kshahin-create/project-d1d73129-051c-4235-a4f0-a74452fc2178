import { useEffect, useState } from "react";
import { ShieldCheck, KeyRound, Trash2, QrCode, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Factor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at?: string;
}

export const TwoFactorSettings = () => {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<{
    factorId: string;
    qr: string;
    secret: string;
    uri: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error(error.message);
    } else {
      setFactors([...(data?.totp ?? []), ...(data?.phone ?? [])] as Factor[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      // امسح أي factors غير مُتحقق منها (من محاولات سابقة) عشان نتجنب تعارض الاسم
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const stale = [
        ...(existing?.totp ?? []),
        ...(existing?.phone ?? []),
      ].filter((f: any) => f.status !== "verified");
      for (const f of stale) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const friendlyName = `Authenticator ${Date.now()}`;
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName,
      });
      if (error) throw error;
      setEnrollData({
        factorId: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      });
    } catch (e: any) {
      toast.error(e.message || "تعذر بدء التفعيل");
    } finally {
      setEnrolling(false);
    }
  };

  const verifyEnroll = async () => {
    if (!enrollData) return;
    if (!/^\d{6}$/.test(code)) {
      toast.error("الرمز يجب أن يكون 6 أرقام");
      return;
    }
    setVerifying(true);
    try {
      const { data: chal, error: ce } = await supabase.auth.mfa.challenge({
        factorId: enrollData.factorId,
      });
      if (ce) throw ce;
      const { error } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId: chal.id,
        code,
      });
      if (error) throw error;
      toast.success("تم تفعيل التحقق بخطوتين");
      setEnrollData(null);
      setCode("");
      load();
    } catch (e: any) {
      toast.error(e.message || "رمز غير صحيح");
    } finally {
      setVerifying(false);
    }
  };

  const cancelEnroll = async () => {
    if (!enrollData) return;
    await supabase.auth.mfa.unenroll({ factorId: enrollData.factorId });
    setEnrollData(null);
    setCode("");
  };

  const remove = async (factorId: string) => {
    if (!confirm("تعطيل هذا العامل؟ هتقدر تعيد تفعيله بعدين.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) toast.error(error.message);
    else {
      toast.success("تم التعطيل");
      load();
    }
  };

  const verifiedFactors = factors.filter((f) => f.status === "verified");
  const hasTotp = verifiedFactors.some((f) => f.factor_type === "totp");

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
      <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg font-extrabold">التحقق بخطوتين (2FA)</h2>
          <p className="text-xs text-muted-foreground">
            طبقة حماية إضافية لحسابك بعد كلمة المرور
          </p>
        </div>
        {hasTotp && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            مفعّل
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">جاري التحميل...</div>
      ) : (
        <>
          {verifiedFactors.length > 0 && (
            <div className="mb-4 space-y-2">
              {verifiedFactors.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {f.friendly_name || "تطبيق المصادقة"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {f.factor_type === "totp" ? "تطبيق Authenticator" : f.factor_type}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(f.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    تعطيل
                  </button>
                </div>
              ))}
            </div>
          )}

          {enrollData ? (
            <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <QrCode className="h-4 w-4 text-primary" />
                امسح هذا الرمز بتطبيق Google Authenticator أو Authy
              </div>
              <div className="flex justify-center rounded-xl bg-white p-4">
                <div
                  className="h-44 w-44"
                  dangerouslySetInnerHTML={{ __html: enrollData.qr }}
                />
              </div>
              <div className="text-center text-xs text-muted-foreground">
                أو أدخل الكود يدوياً:
                <code dir="ltr" className="mx-1 block break-all rounded bg-background px-2 py-1 font-mono text-[11px]">
                  {enrollData.secret}
                </code>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  أدخل الرمز من التطبيق (6 أرقام)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  dir="ltr"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-center font-mono text-lg tracking-widest focus:border-primary focus:outline-none"
                  placeholder="000000"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={verifyEnroll}
                  disabled={verifying || code.length !== 6}
                  className="flex-1 rounded-xl bg-gradient-primary py-2.5 font-display font-bold text-primary-foreground shadow-card transition hover:shadow-elevated disabled:opacity-50"
                >
                  {verifying ? "جاري التحقق..." : "تفعيل"}
                </button>
                <button
                  onClick={cancelEnroll}
                  className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary"
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : !hasTotp ? (
            <button
              onClick={startEnroll}
              disabled={enrolling}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3 font-display font-bold text-primary-foreground shadow-card transition hover:shadow-elevated disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              {enrolling ? "جاري التحضير..." : "تفعيل التحقق بخطوتين"}
            </button>
          ) : null}

          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            <strong>ملاحظة:</strong> بعد التفعيل، سنطلب منك إدخال رمز من تطبيق المصادقة عند كل
            تسجيل دخول. يمكنك أيضاً استخدام رمز التحقق عبر البريد الإلكتروني كبديل
            احتياطي عند الحاجة.
          </p>
        </>
      )}
    </div>
  );
};
