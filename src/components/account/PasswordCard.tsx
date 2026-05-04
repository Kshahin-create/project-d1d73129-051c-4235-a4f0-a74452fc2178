import { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from "lucide-react";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("كلمة المرور يجب ألا تقل عن 8 أحرف");
    if (pwd !== confirm) return toast.error("تأكيد كلمة المرور غير مطابق");

    setSaving(true);
    try {
      // If user has a password, verify current first
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
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success(hasPassword ? "تم تغيير كلمة المرور" : "تم تعيين كلمة المرور");
      setCurrent("");
      setPwd("");
      setConfirm("");
      onPasswordSet?.();
    } catch (e: any) {
      toast.error(e?.message || "فشل حفظ كلمة المرور");
    } finally {
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
