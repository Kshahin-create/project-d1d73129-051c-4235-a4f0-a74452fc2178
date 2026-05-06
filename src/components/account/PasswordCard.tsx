import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  hasPassword: boolean;
  onPasswordSet?: () => void;
}

export const PasswordCard = ({ hasPassword, onPasswordSet }: Props) => {
  const [current, setCurrent] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  // MFA elevation state
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaVerifying, setMfaVerifying] = useState(false);

  const strength = (() => {
    let s = 0;
    if (pwd.length >= 8) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return s;
  })();
  const strengthLabel = ["ضعيفة جداً", "ضعيفة", "متوسطة", "جيدة", "قوية"][strength];
  const strengthColor = ["bg-destructive", "bg-destructive", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"][strength];

  const doUpdatePassword = async () => {
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) throw error;
    toast.success(hasPassword ? "تم تغيير كلمة المرور" : "تم تعيين كلمة المرور");
    setCurrent("");
    setPwd("");
    setConfirm("");
    onPasswordSet?.();
  };

  const ensureAAL2 = async (): Promise<boolean> => {
    // Returns true if already AAL2 or no MFA needed; false if dialog opened to elevate
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!aal) return true;
    if (aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
      if (fErr) throw fErr;
      const totp = factors?.totp?.find((f) => f.status === "verified");
      if (!totp) {
        toast.error("MFA مطلوب لكنه غير مُفعّل بشكل كامل");
        return false;
      }
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (chErr) throw chErr;
      setMfaFactorId(totp.id);
      setMfaChallengeId(ch.id);
      setMfaCode("");
      setMfaOpen(true);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("كلمة المرور يجب ألا تقل عن 8 أحرف");
    if (pwd !== confirm) return toast.error("تأكيد كلمة المرور غير مطابق");

    setSaving(true);
    try {
      if (hasPassword) {
        const { data: u } = await supabase.auth.getUser();
        const email = u.user?.email;
        if (!email) throw new Error("لا يوجد حساب");
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email,
          password: current,
        });
        if (signErr) {
          toast.error("كلمة المرور الحالية غير صحيحة");
          setSaving(false);
          return;
        }
      }

      const ready = await ensureAAL2();
      if (!ready) {
        // Wait for MFA dialog
        setSaving(false);
        return;
      }

      await doUpdatePassword();
    } catch (e: any) {
      toast.error(e?.message || "فشل حفظ كلمة المرور");
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!mfaFactorId || !mfaChallengeId) return;
    if (mfaCode.length < 6) return toast.error("أدخل رمز TOTP المكوّن من 6 أرقام");
    setMfaVerifying(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: mfaCode.trim(),
      });
      if (error) throw error;
      setMfaOpen(false);
      setSaving(true);
      await doUpdatePassword();
    } catch (e: any) {
      toast.error(e?.message || "رمز التحقق غير صحيح");
    } finally {
      setMfaVerifying(false);
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
      <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <KeyRound className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-lg font-extrabold">
            {hasPassword ? "تغيير كلمة المرور" : "تعيين كلمة مرور"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {hasPassword
              ? "غيّر كلمة المرور الخاصة بك للحفاظ على أمان حسابك"
              : "حسابك مفعّل بدون كلمة مرور — أنشئ واحدة لتأمين الدخول"}
          </p>
        </div>
      </div>

      {!hasPassword && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>أنشئ كلمة مرور لتتمكن من الدخول بالبريد أو رقم الجوال + كلمة السر.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {hasPassword && (
          <Field label="كلمة المرور الحالية">
            <PwdInput value={current} onChange={setCurrent} show={show} required />
          </Field>
        )}
        <Field label={hasPassword ? "كلمة المرور الجديدة" : "كلمة المرور"}>
          <PwdInput value={pwd} onChange={setPwd} show={show} required />
        </Field>

        {pwd && (
          <div>
            <div className="mb-1 flex h-1.5 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-full ${i < strength ? strengthColor : "bg-muted"}`}
                />
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground">قوة كلمة المرور: {strengthLabel}</div>
          </div>
        )}

        <Field label="تأكيد كلمة المرور">
          <PwdInput value={confirm} onChange={setConfirm} show={show} required />
        </Field>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={show}
            onChange={(e) => setShow(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          إظهار كلمات المرور
        </label>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3 font-display font-bold text-primary-foreground shadow-card transition hover:shadow-elevated disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {saving ? "جاري الحفظ..." : hasPassword ? "تغيير كلمة المرور" : "تعيين كلمة المرور"}
        </button>
      </form>

      {mfaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !mfaVerifying && setMfaOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-extrabold">تأكيد التحقق بخطوتين</h3>
                <p className="text-xs text-muted-foreground">أدخل الرمز من تطبيق المصادقة لإتمام تغيير كلمة المرور</p>
              </div>
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              dir="ltr"
              className="w-full rounded-xl border border-border bg-background px-3 py-3 text-center text-2xl tracking-[0.4em] focus:border-primary focus:outline-none"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setMfaOpen(false)}
                disabled={mfaVerifying}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleVerifyMfa}
                disabled={mfaVerifying || mfaCode.length < 6}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {mfaVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="mb-1.5 block text-sm font-medium">{label}</label>
    {children}
  </div>
);

const PwdInput = ({
  value,
  onChange,
  show,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  required?: boolean;
}) => (
  <div className="relative">
    <input
      type={show ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      minLength={8}
      dir="ltr"
      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-right focus:border-primary focus:outline-none"
    />
    {value && (
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        {show ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </span>
    )}
  </div>
);
