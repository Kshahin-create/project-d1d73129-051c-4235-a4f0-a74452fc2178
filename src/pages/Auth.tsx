import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { toast } from "sonner";

type Mode = "login-password" | "login-otp" | "signup";

const Auth = () => {
  const navigate = useNavigate();
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

  useEffect(() => {
    if (!authLoading && user) {
      if (isAdmin) navigate("/admin");
      else if (isControl) navigate("/control");
      else navigate("/profile");
    }
  }, [user, isAdmin, isControl, authLoading, navigate]);

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

            {/* Tabs */}
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
