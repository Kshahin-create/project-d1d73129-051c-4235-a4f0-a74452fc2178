import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Mail, ArrowRight, LogIn, User, Phone, Briefcase, FileText } from "lucide-react";
import { isValidPhoneNumber } from "libphonenumber-js";
import { PhoneField } from "@/components/PhoneField";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [activityType, setActivityType] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      if (isAdmin) navigate("/admin");
      else navigate("/profile");
    }
  }, [user, isAdmin, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        if (!fullName.trim() || fullName.trim().length < 3) {
          throw new Error("الاسم الكامل مطلوب (3 أحرف على الأقل)");
        }
        if (!phone || !isValidPhoneNumber(phone)) {
          throw new Error("رقم جوال غير صحيح، تأكد من اختيار الدولة وكتابة الرقم كامل");
        }

        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/profile`,
            data: { display_name: fullName || email },
          },
        });
        if (error) throw error;

        // Save customer profile (auto-confirm is on, so session exists)
        const newUserId = signUpData.user?.id;
        if (newUserId) {
          await supabase.from("customer_profiles").upsert(
            {
              user_id: newUserId,
              full_name: fullName.trim(),
              phone: phone.trim(),
              email: email.trim(),
              business_name: businessName.trim() || null,
              activity_type: activityType.trim() || null,
              notes: notes.trim() || null,
            },
            { onConflict: "user_id" }
          );
        }
        toast.success("تم إنشاء الحساب بنجاح");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("تم تسجيل الدخول بنجاح");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    // Use Supabase OAuth directly so it works on any host (Railway, custom domains, etc.)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/profile`,
      },
    });
    if (error) {
      toast.error("فشل تسجيل الدخول عبر Google");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container-tight py-12">
        <div className="mx-auto max-w-md">
          <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowRight className="h-4 w-4" /> العودة للرئيسية
          </Link>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
            <div className="mb-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <LogIn className="h-6 w-6" />
              </div>
              <h1 className="mt-4 font-display text-2xl font-extrabold">
                {mode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {mode === "login"
                  ? "ادخل لمتابعة الحجوزات وحفظ بياناتك"
                  : "سجّل بياناتك مرة واحدة واستخدمها في كل حجز"}
              </p>
            </div>

            <button
              onClick={handleGoogle}
              disabled={loading}
              className="mb-4 inline-flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-card py-3 font-medium text-foreground transition hover:border-primary/40 hover:bg-secondary disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              متابعة عبر Google
            </button>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">أو</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === "signup" && (
                <>
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
                      رقم الجوال<span className="mr-1 text-destructive">*</span>
                    </label>
                    <PhoneField value={phone} onChange={setPhone} required />
                  </div>
                </>
              )}

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

              {mode === "signup" && (
                <>
                  <FieldWithIcon icon={Briefcase} label="اسم المنشأة / النشاط التجاري">
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
                    <label className="mb-1.5 block text-sm font-medium">نوع النشاط</label>
                    <select
                      value={activityType}
                      onChange={(e) => setActivityType(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 focus:border-primary focus:outline-none"
                    >
                      <option value="">اختر نوع النشاط (اختياري)</option>
                      <option value="مراكز صيانة سيارات">مراكز صيانة سيارات</option>
                      <option value="محلات قطع غيار وبناشر">محلات قطع غيار وبناشر</option>
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
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-primary py-3 font-display font-bold text-primary-foreground shadow-card transition hover:shadow-elevated disabled:opacity-50"
              >
                {loading ? "جاري المعالجة..." : mode === "login" ? "تسجيل الدخول" : "إنشاء الحساب"}
              </button>
            </form>

            <div className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>ليس لديك حساب؟{" "}
                  <button onClick={() => setMode("signup")} className="font-medium text-primary hover:underline">إنشاء حساب جديد</button>
                </>
              ) : (
                <>لديك حساب بالفعل؟{" "}
                  <button onClick={() => setMode("login")} className="font-medium text-primary hover:underline">تسجيل الدخول</button>
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
