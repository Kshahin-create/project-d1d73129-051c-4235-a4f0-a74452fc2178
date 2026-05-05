import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Lock,
  Phone,
  ArrowRight,
  LogIn,
  User,
  Briefcase,
  FileText,
  KeyRound,
  ShieldCheck,
  Mail,
} from "lucide-react";
import { isValidPhoneNumber } from "libphonenumber-js";
import { PhoneField } from "@/components/PhoneField";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { toast } from "sonner";

// 3 modes: login with phone+password, signup (phone OTP -> set password), forgot (phone OTP -> new password)
type Mode = "login" | "signup" | "forgot";
type Step = "form" | "verify" | "set-password";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const { user, isAdmin, isControl, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("form");

  // form fields
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [activityType, setActivityType] = useState("");
  const [notes, setNotes] = useState("");

  // OTP
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);

  // MFA challenge
  const [mfaChallenge, setMfaChallenge] = useState<{
    factorId: string;
    challengeId: string;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const checkMfaChallenge = async (): Promise<boolean> => {
    const { data: aalData } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.nextLevel === "aal2" && aalData.currentLevel !== "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find((f) => f.status === "verified");
      if (totp) {
        const { data: chal, error } = await supabase.auth.mfa.challenge({
          factorId: totp.id,
        });
        if (!error && chal) {
          setMfaChallenge({ factorId: totp.id, challengeId: chal.id });
          return true;
        }
      }
    }
    return false;
  };

  const verifyMfa = async () => {
    if (!mfaChallenge) return;
    if (!/^\d{6}$/.test(mfaCode)) {
      toast.error("الرمز يجب أن يكون 6 أرقام");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaChallenge.factorId,
        challengeId: mfaChallenge.challengeId,
        code: mfaCode,
      });
      if (error) throw error;
      toast.success("تم تسجيل الدخول بنجاح");
      setMfaChallenge(null);
      setMfaCode("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "رمز غير صحيح";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && !mfaChallenge) {
      if (redirectTo) navigate(redirectTo);
      else if (isAdmin) navigate("/admin");
      else if (isControl) navigate("/control");
      else navigate("/profile");
    }
  }, [
    user,
    isAdmin,
    isControl,
    authLoading,
    navigate,
    redirectTo,
    mfaChallenge,
  ]);

  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = window.setTimeout(
      () => setCooldown((c) => c - 1),
      1000,
    );
    return () => {
      if (cooldownRef.current) window.clearTimeout(cooldownRef.current);
    };
  }, [cooldown]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setStep("form");
    setCode("");
    setPassword("");
    setNewPassword("");
  };

  // Normalize phone to international without "+"
  const normalizePhone = (p: string): string => {
    let n = (p || "").replace(/[\s\-()+]/g, "");
    if (n.startsWith("00")) n = n.slice(2);
    if (n.startsWith("0") && n.length === 10) n = "966" + n.slice(1);
    return n;
  };

  // === Login: phone + password ===
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !isValidPhoneNumber(phone)) {
      toast.error("رقم جوال غير صحيح");
      return;
    }
    if (!password) {
      toast.error("أدخل كلمة المرور");
      return;
    }
    setLoading(true);
    try {
      const normalized = normalizePhone(phone);
      // Try alias email first
      const aliasEmail = `${normalized}@phone.mnicity.app`;
      let { error } = await supabase.auth.signInWithPassword({
        email: aliasEmail,
        password,
      });
      // If failed, try lookup of stored email by phone via a lightweight RPC (skipped — alias is canonical)
      if (error) throw error;
      const needsMfa = await checkMfaChallenge();
      if (needsMfa) {
        toast.message("أدخل رمز التحقق بخطوتين");
        return;
      }
      toast.success("تم تسجيل الدخول بنجاح");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "بيانات الدخول غير صحيحة";
      toast.error(msg.includes("Invalid") ? "رقم الجوال أو كلمة المرور غير صحيحة" : msg);
    } finally {
      setLoading(false);
    }
  };

  // === Send OTP via SMS ===
  const sendSmsOtp = async (purpose: "signup" | "reset") => {
    if (!phone || !isValidPhoneNumber(phone)) {
      toast.error("رقم جوال غير صحيح");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms-otp", {
        body: { phone: normalizePhone(phone), purpose },
      });
      if (error) throw error;
      const res = data as { error?: string } | null;
      if (res?.error) throw new Error(res.error);
      toast.success("تم إرسال الرمز إلى جوالك");
      setStep("verify");
      setCooldown(60);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر إرسال الرمز";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // === Verify OTP + create account / reset password ===
  const verifySmsOtp = async () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error("الرمز يجب أن يكون 6 أرقام");
      return;
    }
    const purpose: "signup" | "reset" = mode === "signup" ? "signup" : "reset";
    const pwd = purpose === "signup" ? password : newPassword;
    if (!pwd || pwd.length < 8) {
      toast.error("كلمة المرور يجب ألا تقل عن 8 أحرف");
      return;
    }
    setLoading(true);
    try {
      const normalized = normalizePhone(phone);
      const payload: Record<string, unknown> = {
        phone: normalized,
        code,
        password: pwd,
        purpose,
      };
      if (purpose === "signup") {
        payload.fullName = fullName.trim();
        payload.email = email.trim();
        payload.businessName = businessName.trim();
        payload.activityType = activityType.trim();
        payload.notes = notes.trim();
      }
      const { data, error } = await supabase.functions.invoke("verify-sms-otp", {
        body: payload,
      });
      if (error) throw error;
      const res = data as { error?: string; login_email?: string } | null;
      if (res?.error) throw new Error(res.error);

      // Auto-login with the alias/email returned
      const loginEmail = res?.login_email || `${normalized}@phone.mnicity.app`;
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: pwd,
      });
      if (signErr) throw signErr;

      const needsMfa = await checkMfaChallenge();
      if (needsMfa) {
        toast.message("أدخل رمز التحقق بخطوتين");
        return;
      }
      toast.success(
        purpose === "signup" ? "تم إنشاء الحساب وتسجيل الدخول" : "تم تحديث كلمة المرور",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "تعذر التحقق من الرمز";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "تعذر تسجيل الدخول عبر Apple";
      toast.error(msg);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "تعذر تسجيل الدخول عبر Google";
      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container-tight py-12">
        <div className="mx-auto max-w-md">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4" /> العودة للرئيسية
          </Link>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
            {mfaChallenge ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h1 className="mt-4 font-display text-2xl font-extrabold">
                    التحقق بخطوتين
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    أدخل الرمز المكوّن من 6 أرقام
                  </p>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  dir="ltr"
                  autoFocus
                  className="w-full rounded-xl border border-border bg-background px-3 py-3 text-center font-mono text-2xl tracking-widest focus:border-primary focus:outline-none"
                  placeholder="000000"
                />
                <button
                  type="button"
                  onClick={verifyMfa}
                  disabled={loading || mfaCode.length !== 6}
                  className="w-full rounded-xl bg-gradient-primary py-3 font-display font-bold text-primary-foreground shadow-card transition hover:shadow-elevated disabled:opacity-50"
                >
                  {loading ? "جاري التحقق..." : "تأكيد"}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setMfaChallenge(null);
                    setMfaCode("");
                  }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground"
                >
                  إلغاء وتسجيل الخروج
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    {mode === "signup" ? (
                      <User className="h-6 w-6" />
                    ) : mode === "forgot" ? (
                      <KeyRound className="h-6 w-6" />
                    ) : (
                      <LogIn className="h-6 w-6" />
                    )}
                  </div>
                  <h1 className="mt-4 font-display text-2xl font-extrabold">
                    {mode === "signup"
                      ? "إنشاء حساب جديد"
                      : mode === "forgot"
                        ? "استعادة كلمة المرور"
                        : "تسجيل الدخول"}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {mode === "signup"
                      ? "سجّل بياناتك مرة واحدة برقم جوالك"
                      : mode === "forgot"
                        ? "سنرسل رمز تحقق لجوالك لتعيين كلمة مرور جديدة"
                        : "ادخل برقم جوالك وكلمة المرور"}
                  </p>
                </div>

                {/* Social Sign In */}
                <div className="mb-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    dir="ltr"
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Google</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAppleSignIn}
                    disabled={loading}
                    dir="ltr"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                      <path d="M16.365 1.43c0 1.14-.46 2.27-1.21 3.06-.81.85-2.13 1.5-3.22 1.41-.13-1.13.43-2.32 1.18-3.13.84-.91 2.27-1.6 3.25-1.34zM20.7 17.46c-.55 1.27-.81 1.83-1.51 2.95-.98 1.55-2.36 3.49-4.07 3.5-1.52.02-1.91-.99-3.97-.98-2.06.01-2.49 1-4.01.98-1.71-.02-3.02-1.77-4-3.32C.45 16.16-.16 11.61 1.66 8.74 2.95 6.71 4.99 5.55 7 5.55c2.04 0 3.32 1.12 5 1.12 1.63 0 2.62-1.12 4.98-1.12 1.79 0 3.69.98 5.04 2.67-4.43 2.43-3.71 8.76-1.32 9.24z" />
                    </svg>
                    <span>Apple</span>
                  </button>
                </div>

                <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  <span>أو</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* === LOGIN === */}
                {mode === "login" && (
                  <form onSubmit={handleLogin} className="space-y-3.5">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">
                        رقم الجوال
                        <span className="mr-1 text-destructive">*</span>
                      </label>
                      <PhoneField value={phone} onChange={setPhone} required />
                    </div>
                    <FieldWithIcon icon={Lock} label="كلمة المرور" required>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 focus:border-primary focus:outline-none"
                        placeholder="••••••••"
                      />
                    </FieldWithIcon>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-gradient-primary py-3 font-display font-bold text-primary-foreground shadow-card transition hover:shadow-elevated disabled:opacity-50"
                    >
                      {loading ? "جاري المعالجة..." : "تسجيل الدخول"}
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="block w-full text-center text-xs text-primary hover:underline"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </form>
                )}

                {/* === SIGNUP form === */}
                {mode === "signup" && step === "form" && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">
                        رقم الجوال
                        <span className="mr-1 text-destructive">*</span>
                      </label>
                      <PhoneField value={phone} onChange={setPhone} required />
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        سنرسل لك رمز تحقق عبر SMS لإنشاء حسابك. باقي البيانات تُكمل عند الحجز.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => sendSmsOtp("signup")}
                      disabled={loading}
                      className="w-full rounded-xl bg-gradient-primary py-3 font-display font-bold text-primary-foreground shadow-card transition hover:shadow-elevated disabled:opacity-50"
                    >
                      {loading ? "جاري الإرسال..." : "إرسال رمز SMS"}
                    </button>
                  </div>
                )}

                {/* === FORGOT form === */}
                {mode === "forgot" && step === "form" && (
                  <div className="space-y-3.5">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">
                        رقم الجوال المسجّل
                        <span className="mr-1 text-destructive">*</span>
                      </label>
                      <PhoneField value={phone} onChange={setPhone} required />
                    </div>
                    <FieldWithIcon icon={Lock} label="كلمة المرور الجديدة" required>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 focus:border-primary focus:outline-none"
                        placeholder="٨ أحرف على الأقل"
                      />
                    </FieldWithIcon>
                    <p className="text-xs text-muted-foreground">
                      ملاحظة: يمكن طلب رمز الاستعادة مرتين فقط كل ٣ ساعات.
                    </p>
                    <button
                      type="button"
                      onClick={() => sendSmsOtp("reset")}
                      disabled={loading}
                      className="w-full rounded-xl bg-gradient-primary py-3 font-display font-bold text-primary-foreground shadow-card transition hover:shadow-elevated disabled:opacity-50"
                    >
                      {loading ? "جاري الإرسال..." : "إرسال رمز التحقق"}
                    </button>
                  </div>
                )}

                {/* === VERIFY OTP === */}
                {(mode === "signup" || mode === "forgot") && step === "verify" && (
                  <OtpVerifyBox
                    target={phone}
                    code={code}
                    setCode={setCode}
                    onVerify={verifySmsOtp}
                    onResend={() =>
                      sendSmsOtp(mode === "signup" ? "signup" : "reset")
                    }
                    onBack={() => setStep("form")}
                    cooldown={cooldown}
                    loading={loading}
                    actionLabel={
                      mode === "signup" ? "تأكيد وإنشاء الحساب" : "تأكيد وتغيير كلمة المرور"
                    }
                    extraField={
                      <FieldWithIcon
                        icon={Lock}
                        label={mode === "signup" ? "كلمة المرور الجديدة" : "كلمة المرور الجديدة"}
                        required
                      >
                        <input
                          type="password"
                          required
                          minLength={8}
                          value={mode === "signup" ? password : newPassword}
                          onChange={(e) =>
                            mode === "signup"
                              ? setPassword(e.target.value)
                              : setNewPassword(e.target.value)
                          }
                          className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 focus:border-primary focus:outline-none"
                          placeholder="٨ أحرف على الأقل"
                        />
                      </FieldWithIcon>
                    }
                  />
                )}

                <div className="mt-5 text-center text-sm text-muted-foreground">
                  {mode === "signup" ? (
                    <>
                      لديك حساب بالفعل؟{" "}
                      <button
                        onClick={() => switchMode("login")}
                        className="font-medium text-primary hover:underline"
                      >
                        تسجيل الدخول
                      </button>
                    </>
                  ) : mode === "forgot" ? (
                    <button
                      onClick={() => switchMode("login")}
                      className="font-medium text-primary hover:underline"
                    >
                      العودة لتسجيل الدخول
                    </button>
                  ) : (
                    <>
                      ليس لديك حساب؟{" "}
                      <button
                        onClick={() => switchMode("signup")}
                        className="font-medium text-primary hover:underline"
                      >
                        إنشاء حساب جديد
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const OtpVerifyBox = ({
  target,
  code,
  setCode,
  onVerify,
  onResend,
  onBack,
  cooldown,
  loading,
  actionLabel,
}: {
  target: string;
  code: string;
  setCode: (s: string) => void;
  onVerify: () => void;
  onResend: () => void;
  onBack: () => void;
  cooldown: number;
  loading: boolean;
  actionLabel: string;
}) => (
  <div className="space-y-4">
    <div className="rounded-xl border border-border bg-secondary/40 p-3 text-center text-sm">
      تم إرسال رمز SMS إلى{" "}
      <span dir="ltr" className="font-semibold text-foreground">
        {target}
      </span>
    </div>
    <div>
      <label className="mb-1.5 block text-sm font-medium">رمز التحقق</label>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          dir="ltr"
          className="w-full rounded-xl border border-border bg-background py-3 pr-10 pl-3 text-center text-2xl font-bold tracking-[0.5em] focus:border-primary focus:outline-none"
          placeholder="------"
        />
      </div>
    </div>
    <button
      type="button"
      onClick={onVerify}
      disabled={loading || code.length !== 6}
      className="w-full rounded-xl bg-gradient-primary py-3 font-display font-bold text-primary-foreground shadow-card transition hover:shadow-elevated disabled:opacity-50"
    >
      {loading ? "جاري التحقق..." : actionLabel}
    </button>
    <div className="flex items-center justify-between text-sm">
      <button
        type="button"
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground"
      >
        تعديل البيانات
      </button>
      <button
        type="button"
        onClick={onResend}
        disabled={cooldown > 0 || loading}
        className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
      >
        {cooldown > 0 ? `إعادة الإرسال خلال ${cooldown}ث` : "إعادة إرسال الرمز"}
      </button>
    </div>
  </div>
);

const FieldWithIcon = ({
  icon: Icon,
  label,
  required,
  children,
}: {
  icon: typeof Phone;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div>
    <label className="mb-1.5 block text-sm font-medium">
      {label}
      {required && <span className="mr-1 text-destructive">*</span>}
    </label>
    <div className="relative">
      <Icon className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
      {children}
    </div>
  </div>
);

export default Auth;
