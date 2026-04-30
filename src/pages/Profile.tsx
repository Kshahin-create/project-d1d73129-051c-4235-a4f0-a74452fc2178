import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Save, UserCircle2, LogOut } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ProfileData = {
  full_name: string;
  phone: string;
  email: string;
  business_name: string;
  activity_type: string;
  notes: string;
};

const empty: ProfileData = {
  full_name: "",
  phone: "",
  email: "",
  business_name: "",
  activity_type: "",
  notes: "",
};

const Profile = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [data, setData] = useState<ProfileData>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("customer_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data: row }) => {
        setData({
          full_name: row?.full_name ?? "",
          phone: row?.phone ?? "",
          email: row?.email ?? user.email ?? "",
          business_name: row?.business_name ?? "",
          activity_type: row?.activity_type ?? "",
          notes: row?.notes ?? "",
        });
        setLoading(false);
      });
  }, [user]);

  const update = (k: keyof ProfileData, v: string) =>
    setData((d) => ({ ...d, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!data.full_name.trim() || data.full_name.trim().length < 3) {
      toast.error("الاسم الكامل مطلوب");
      return;
    }
    if (!/^(\+?966|0)?5\d{8}$|^\+[1-9]\d{7,14}$/.test(data.phone.trim())) {
      toast.error("رقم جوال غير صحيح");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("customer_profiles").upsert(
      {
        user_id: user.id,
        full_name: data.full_name.trim(),
        phone: data.phone.trim(),
        email: data.email.trim() || user.email,
        business_name: data.business_name.trim() || null,
        activity_type: data.activity_type.trim() || null,
        notes: data.notes.trim() || null,
      },
      { onConflict: "user_id" }
    );
    setSaving(false);
    if (error) toast.error("فشل حفظ البيانات");
    else toast.success("تم حفظ بياناتك بنجاح");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container-tight py-10">
        <div className="mx-auto max-w-2xl">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4" /> العودة للرئيسية
          </Link>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
            <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <UserCircle2 className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h1 className="font-display text-xl font-extrabold">حسابي</h1>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                خروج
              </button>
            </div>

            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                جاري التحميل...
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  بياناتك هتتعبّى تلقائياً في أي حجز جاي. عدّلها وقت ما تحب.
                </p>

                <Field label="الاسم الكامل" required>
                  <input
                    type="text"
                    required
                    value={data.full_name}
                    onChange={(e) => update("full_name", e.target.value)}
                    maxLength={100}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 focus:border-primary focus:outline-none"
                  />
                </Field>

                <Field label="رقم الجوال" required>
                  <input
                    type="tel"
                    required
                    value={data.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    dir="ltr"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-left focus:border-primary focus:outline-none"
                    placeholder="+966 5X XXX XXXX"
                  />
                </Field>

                <Field label="البريد الإلكتروني">
                  <input
                    type="email"
                    value={data.email}
                    onChange={(e) => update("email", e.target.value)}
                    dir="ltr"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-right focus:border-primary focus:outline-none"
                  />
                </Field>

                <Field label="اسم المنشأة / النشاط التجاري">
                  <input
                    type="text"
                    value={data.business_name}
                    onChange={(e) => update("business_name", e.target.value)}
                    maxLength={150}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 focus:border-primary focus:outline-none"
                    placeholder="مركز صيانة سيارات / محل قطع غيار..."
                  />
                </Field>

                <Field label="نوع النشاط">
                  <select
                    value={data.activity_type}
                    onChange={(e) => update("activity_type", e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 focus:border-primary focus:outline-none"
                  >
                    <option value="">اختر نوع النشاط</option>
                    <option value="مراكز صيانة سيارات">مراكز صيانة سيارات</option>
                    <option value="محلات قطع غيار وبناشر">محلات قطع غيار وبناشر</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </Field>

                <Field label="ملاحظات">
                  <textarea
                    value={data.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 focus:border-primary focus:outline-none"
                  />
                </Field>

                <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3 font-display font-bold text-primary-foreground shadow-card transition hover:shadow-elevated disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? "جاري الحفظ..." : "حفظ البيانات"}
                  </button>
                  <Link
                    to="/booking"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 font-medium transition hover:border-primary/40"
                  >
                    احجز وحدة
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const Field = ({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div>
    <label className="mb-1.5 block text-sm font-medium">
      {label}
      {required && <span className="mr-1 text-destructive">*</span>}
    </label>
    {children}
  </div>
);

export default Profile;
