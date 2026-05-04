import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Save, LogOut, Package, Calendar, CheckCircle2, Clock, Mail, Phone, Sparkles } from "lucide-react";
import { isValidPhoneNumber } from "libphonenumber-js";
import { PhoneField } from "@/components/PhoneField";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LinkedAccounts } from "@/components/account/LinkedAccounts";
import { TwoFactorSettings } from "@/components/account/TwoFactorSettings";
import { AvatarUpload } from "@/components/account/AvatarUpload";
import { PasswordCard } from "@/components/account/PasswordCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type BookingRow = {
  id: string;
  status: string;
  total_area: number;
  total_price: number;
  units_count: number;
  whatsapp_sent: boolean;
  created_at: string;
  booking_units: {
    building_number: number;
    unit_number: number;
    unit_type: string | null;
    area: number;
    price: number;
  }[];
};

type ProfileData = {
  full_name: string;
  phone: string;
  email: string;
  business_name: string;
  activity_type: string;
  notes: string;
  avatar_url: string | null;
};

const empty: ProfileData = {
  full_name: "",
  phone: "",
  email: "",
  business_name: "",
  activity_type: "",
  notes: "",
  avatar_url: null,
};

const Profile = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [data, setData] = useState<ProfileData>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);

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
          avatar_url: (row as any)?.avatar_url ?? null,
        });
        setLoading(false);
      });
  }, [user]);

  // جلب حجوزات المستخدم
  useEffect(() => {
    if (!user) return;
    setBookingsLoading(true);
    supabase
      .from("bookings")
      .select("id,status,total_area,total_price,units_count,whatsapp_sent,created_at,booking_units(building_number,unit_number,unit_type,area,price)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data: rows, error }) => {
        if (error) console.error(error);
        setBookings((rows as BookingRow[] | null) ?? []);
        setBookingsLoading(false);
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
    if (!data.phone || !isValidPhoneNumber(data.phone)) {
      toast.error("رقم جوال غير صحيح، تأكد من اختيار الدولة وكتابة الرقم كامل");
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

          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-l from-primary/15 via-accent/10 to-transparent" />
            <div className="relative">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:gap-6">
                <AvatarUpload
                  userId={user.id}
                  avatarUrl={data.avatar_url}
                  fullName={data.full_name || user.email || ""}
                  onChange={(url) => setData((d) => ({ ...d, avatar_url: url }))}
                />
                <div className="flex-1 text-center sm:text-right">
                  <h1 className="font-display text-2xl font-extrabold">
                    {data.full_name || "حسابي"}
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground sm:justify-start">
                    {data.email && (
                      <span dir="ltr" className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {data.email}
                      </span>
                    )}
                    {data.phone && (
                      <span dir="ltr" className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {data.phone}
                      </span>
                    )}
                  </div>
                  {isAdmin && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                      <Sparkles className="h-3 w-3" /> مسؤول
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  خروج
                </button>
              </div>
            </div>
            <div className="mt-6 border-t border-border pt-6">

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
                  <PhoneField
                    value={data.phone}
                    onChange={(v) => update("phone", v)}
                    required
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

                {!isAdmin && (
                  <>
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
                  </>
                )}

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

          {/* قسم حجوزاتي */}
          {!isAdmin && (
            <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
              <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <Package className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h2 className="font-display text-lg font-extrabold">حجوزاتي</h2>
                  <p className="text-xs text-muted-foreground">
                    {bookings.length > 0 ? `${bookings.length} حجز` : "لم تقم بأي حجز بعد"}
                  </p>
                </div>
              </div>

              {bookingsLoading ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  جاري تحميل الحجوزات...
                </div>
              ) : bookings.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">لا توجد حجوزات بعد</p>
                  <Link
                    to="/booking"
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:opacity-90"
                  >
                    احجز أول وحدة
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {bookings.map((b) => (
                    <BookingCard key={b.id} booking={b} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* أمان الحساب */}
          <div className="mt-6 space-y-6">
            <PasswordCard hasPassword={hasPassword} />
            <LinkedAccounts />
            <TwoFactorSettings />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const statusLabel = (s: string) =>
  s === "confirmed" ? "مؤكّد" : s === "cancelled" ? "ملغى" : "قيد المعالجة";

const BookingCard = ({ booking }: { booking: BookingRow }) => {
  const date = new Date(booking.created_at).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const isConfirmed = booking.status === "confirmed";
  const isCancelled = booking.status === "cancelled";

  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{date}</span>
          <span className="font-mono opacity-60">#{booking.id.slice(0, 8)}</span>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
            isConfirmed
              ? "bg-success/15 text-success"
              : isCancelled
                ? "bg-destructive/15 text-destructive"
                : "bg-primary/15 text-primary"
          }`}
        >
          {isConfirmed ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {statusLabel(booking.status)}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {booking.booking_units?.map((u, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"
          >
            مبنى {u.building_number} — وحدة #{u.unit_number}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center text-xs">
        <div>
          <div className="text-muted-foreground">الوحدات</div>
          <div className="num mt-0.5 font-bold">{booking.units_count}</div>
        </div>
        <div>
          <div className="text-muted-foreground">المساحة</div>
          <div className="num mt-0.5 font-bold">{Number(booking.total_area)} م²</div>
        </div>
        <div>
          <div className="text-muted-foreground">الإيجار</div>
          <div className="num mt-0.5 font-bold text-accent">
            {Number(booking.total_price).toLocaleString("en-US")}
          </div>
        </div>
      </div>

      {booking.whatsapp_sent && (
        <div className="mt-3 text-center text-[11px] text-success">
          ✓ تم إرسال التفاصيل عبر واتساب
        </div>
      )}
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
