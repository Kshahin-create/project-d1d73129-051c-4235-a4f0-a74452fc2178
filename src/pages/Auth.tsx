import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Lock,
  Mail,
  ArrowRight,
  LogIn,
  User,
  Briefcase,
  FileText,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { isValidPhoneNumber } from "libphonenumber-js";
import { PhoneField } from "@/components/PhoneField";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { toast } from "sonner";

type Mode = "login-password" | "login-otp" | "signup";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const { user, isAdmin, isControl, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<Mode>("login-otp");

  // form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [activityType, setActivityType] = useState("");
  const [notes, setNotes] = useState("");

  // OTP state
  const [otpStep, setOtpStep] = useState<"request" | "verify">("request");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(false);

  // MFA (TOTP) challenge state
  const [mfaChallenge, setMfaChallenge] = useState<{
    factorId: string;
    challengeId: string;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  const checkMfaChallenge = async (): Promise<boolean> => {
    // Returns true if a challenge was started (caller should stop)
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
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
    } catch (e: any) {
      toast.error(e.message || "رمز غير صحيح");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      if (redirectTo) navigate(redirectTo);
      else if (isAdmin) navigate("/admin");
      else if (isControl) navigate("/control");
      else navigate("/profile");
    }
  }, [user, isAdmin, isControl, authLoading, navigate, redirectTo]);

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
    setOtpStep("request");
    setCode("");
  };

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const sendOtp = async (purpose: "login" | "signup") => {
    if (!isValidEmail(email)) {
      toast.error("بريد إلكتروني غير صحيح");
      return;
    }
    if (purpose === "signup") {
      if (!fullName.trim() || fullName.trim().length < 3) {
        toast.error("الاسم الكامل مطلوب");
        return;
      }
      if (!phone || !isValidPhoneNumber(phone)) {
        toast.error("رقم جوال غير صحيح");
        return;
      }
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { email: email.trim().toLowerCase(), purpose },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("تم إرسال الرمز إلى بريدك");
      setOtpStep("verify");
      setCooldown(60);
    } catch (e: any) {
      toast.error(e.message || "تعذر إرسال الرمز");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error("الرمز يجب أن يكون 6 أرقام");
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        email: email.trim().toLowerCase(),
        code,
      };
      if (mode === "signup") {
        payload.fullName = fullName.trim();
        payload.phone = phone.trim();
        payload.businessName = businessName.trim();
        payload.activityType = activityType.trim();
        payload.notes = notes.trim();
      }
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: payload,
      });
      if (error) throw error;
      const res = data as any;
      if (res?.error) throw new Error(res.error);
      if (!res?.verification_token) throw new Error("استجابة غير صحيحة");

      // Establish session using the hashed token from generateLink (magiclink)
      const { error: vErr } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: res.verification_token,
      });
      if (vErr) throw vErr;
      toast.success("تم تسجيل الدخول بنجاح");
    } catch (e: any) {
      toast.error(e.message || "تعذر التحقق من الرمز");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      toast.success("تم تسجيل الدخول بنجاح");
    } catch (err: any) {
      toast.error(err.message || "بيانات الدخول غير صحيحة");
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
      // If redirected, the browser is leaving — nothing more to do.
    } catch (err: any) {
      toast.error(err.message || "تعذر تسجيل الدخول عبر Apple");
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
    } catch (err: any) {
      toast.error(err.message || "تعذر تسجيل الدخول عبر Google");
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
            <div className="mb-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                {mode === "signup" ? (
                  <User className="h-6 w-6" />
                ) : mode === "login-otp" ? (
                  <ShieldCheck className="h-6 w-6" />
                ) : (
                  <LogIn className="h-6 w-6" />
                )}
              </div>
              <h1 className="mt-4 font-display text-2xl font-extrabold">
                {mode === "signup"
                  ? "إنشاء حساب جديد"
                  : mode === "login-otp"
                    ? "تسجيل الدخول برمز التحقق"
                    : "تسجيل الدخول بكلمة المرور"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "signup"
                  ? "سجّل بياناتك مرة واحدة واستخدمها في كل حجز"
                  : mode === "login-otp"
                    ? "أدخل بريدك وسنرسل لك رمز تحقق من 6 أرقام"
                    : "ادخل لمتابعة الحجوزات وحفظ بياناتك"}
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

            {mode !== "signup" && (
              <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <span>أو</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}

            {mode !== "signup" && (
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1 text-sm">
                <button
                  type="button"
                  onClick={() => switchMode("login-otp")}
                  className={`rounded-lg py-2 font-medium transition ${
                    mode === "login-otp"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  رمز عبر البريد
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("login-password")}
                  className={`rounded-lg py-2 font-medium transition ${
                    mode === "login-password"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  كلمة المرور
                </button>
              </div>
            )}

            {/* LOGIN-OTP */}
            {mode === "login-otp" && otpStep === "request" && (
              <div className="space-y-3.5">
                <FieldWithIcon icon={Mail} label="البريد الإلكتروني" required>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 text-right focus:border-primary focus:outline-none"
                    placeholder="name@example.com"
                  />
                </FieldWithIcon>
                <button
                  type="button"
                  onClick={() => sendOtp("login")}
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-primary py-3 font-display font-bold text-primary-foreground shadow-card transition hover:shadow-elevated disabled:opacity-50"
                >
                  {loading ? "جاري الإرسال..." : "إرسال رمز التحقق"}
                </button>
              </div>
            )}

            {mode === "login-otp" && otpStep === "verify" && (
              <OtpVerifyBox
                email={email}
                code={code}
                setCode={setCode}
                onVerify={verifyOtp}
                onResend={() => sendOtp("login")}
                onBack={() => setOtpStep("request")}
                cooldown={cooldown}
                loading={loading}
              />
            )}

            {/* LOGIN-PASSWORD */}
            {mode === "login-password" && (
              <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
                <FieldWithIcon icon={Mail} label="البريد الإلكتروني" required>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 text-right focus:border-primary focus:outline-none"
                    placeholder="name@example.com"
                  />
                </FieldWithIcon>
                <FieldWithIcon icon={Lock} label="كلمة المرور" required>
                  <input
                    type="password"
                    required
                    minLength={6}
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
              </form>
            )}

            {/* SIGNUP */}
            {mode === "signup" && otpStep === "request" && (
              <div className="space-y-3.5">
                <FieldWithIcon icon={User} label="الاسم الكامل" required>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 focus:border-primary focus:outline-none"
                    placeholder="محمد عبدالله السالم"
                  />
                </FieldWithIcon>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    رقم الجوال
                    <span className="mr-1 text-destructive">*</span>
                  </label>
                  <PhoneField value={phone} onChange={setPhone} required />
                </div>

                <FieldWithIcon icon={Mail} label="البريد الإلكتروني" required>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 text-right focus:border-primary focus:outline-none"
                    placeholder="name@example.com"
                  />
                </FieldWithIcon>

                <FieldWithIcon
                  icon={Briefcase}
                  label="اسم المنشأة / النشاط التجاري"
                >
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    maxLength={150}
                    className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 focus:border-primary focus:outline-none"
                    placeholder="مركز صيانة سيارات / محل قطع غيار..."
                  />
                </FieldWithIcon>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    نوع النشاط
                  </label>
                  <select
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 focus:border-primary focus:outline-none"
                  >
                    <option value="">اختر نوع النشاط (اختياري)</option>
                    <option value="مراكز صيانة سيارات">
                      مراكز صيانة سيارات
                    </option>
                    <option value="محلات قطع غيار وبناشر">
                      محلات قطع غيار وبناشر
                    </option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>

                <FieldWithIcon icon={FileText} label="ملاحظات (اختياري)">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    maxLength={500}
                    className="w-full rounded-xl border border-border bg-background py-2.5 pr-10 pl-3 focus:border-primary focus:outline-none"
                    placeholder="أي تفاصيل إضافية..."
                  />
                </FieldWithIcon>

                <button
                  type="button"
                  onClick={() => sendOtp("signup")}
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-primary py-3 font-display font-bold text-primary-foreground shadow-card transition hover:shadow-elevated disabled:opacity-50"
                >
                  {loading ? "جاري الإرسال..." : "إرسال رمز التأكيد"}
                </button>
              </div>
            )}

            {mode === "signup" && otpStep === "verify" && (
              <OtpVerifyBox
                email={email}
                code={code}
                setCode={setCode}
                onVerify={verifyOtp}
                onResend={() => sendOtp("signup")}
                onBack={() => setOtpStep("request")}
                cooldown={cooldown}
                loading={loading}
              />
            )}

            <div className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "signup" ? (
                <>
                  لديك حساب بالفعل؟{" "}
                  <button
                    onClick={() => switchMode("login-otp")}
                    className="font-medium text-primary hover:underline"
                  >
                    تسجيل الدخول
                  </button>
                </>
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
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const OtpVerifyBox = ({
  email,
  code,
  setCode,
  onVerify,
  onResend,
  onBack,
  cooldown,
  loading,
}: {
  email: string;
  code: string;
  setCode: (s: string) => void;
  onVerify: () => void;
  onResend: () => void;
  onBack: () => void;
  cooldown: number;
  loading: boolean;
}) => (
  <div className="space-y-4">
    <div className="rounded-xl border border-border bg-secondary/40 p-3 text-center text-sm">
      تم إرسال رمز تحقق إلى{" "}
      <span dir="ltr" className="font-semibold text-foreground">
        {email}
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
      {loading ? "جاري التحقق..." : "تأكيد ودخول"}
    </button>

    <div className="flex items-center justify-between text-sm">
      <button
        type="button"
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground"
      >
        تعديل البريد
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
  icon: typeof Mail;
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
