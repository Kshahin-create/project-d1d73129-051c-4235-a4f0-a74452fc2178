import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarRange, Lock, Search, ArrowRight, Phone, Mail, Building2, CheckCircle2, XCircle, Clock, FileImage, TimerReset, TrendingUp, Wallet, Layers, Hourglass } from "lucide-react";
import { fmtNum } from "@/lib/utils";

interface BookingUnitRow {
  building_number: number;
  unit_number: number;
  unit_type: string | null;
  area: number;
  price: number;
}

interface BookingRow {
  id: string;
  user_id: string;
  customer_full_name: string;
  customer_phone: string;
  customer_email: string | null;
  business_name: string | null;
  notes: string | null;
  status: string;
  total_area: number;
  total_price: number;
  paid_amount: number;
  units_count: number;
  whatsapp_sent: boolean;
  offer_image_url: string | null;
  created_at: string;
  expires_at: string;
  booking_units?: BookingUnitRow[];
}

const STATUS: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: "قيد المراجعة", cls: "bg-amber-500/10 text-amber-600", Icon: Clock },
  confirmed: { label: "مؤكد", cls: "bg-emerald-500/10 text-emerald-600", Icon: CheckCircle2 },
  cancelled: { label: "ملغي", cls: "bg-destructive/10 text-destructive", Icon: XCircle },
  expired: { label: "منتهي الصلاحية", cls: "bg-muted text-muted-foreground", Icon: Clock },
};

const TONE_CLS: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600",
  amber: "bg-amber-500/10 text-amber-600",
  rose: "bg-rose-500/10 text-rose-600",
};

function StatCard({
  title,
  value,
  hint,
  Icon,
  tone = "primary",
}: {
  title: string;
  value: string;
  hint?: string;
  Icon: typeof Clock;
  tone?: "primary" | "emerald" | "amber" | "rose";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-muted-foreground sm:text-xs">{title}</div>
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${TONE_CLS[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="mt-1.5 font-display text-lg font-bold leading-tight sm:text-xl">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">{hint}</div>}
    </div>
  );
}

const AdminBookings = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isManager, loading } = useAuth();
  const canAccess = isAdmin || isManager;
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "confirmed" | "cancelled" | "expired">("all");

  const load = async () => {
    setFetching(true);
    // قبل التحميل، شغّل تنظيف الحجوزات منتهية الصلاحية (48 ساعة)
    await supabase.rpc("expire_pending_bookings" as any);
    const { data, error } = await supabase
      .from("bookings")
      .select("*, booking_units(building_number,unit_number,unit_type,area,price)")
      .order("created_at", { ascending: false });
    if (error) toast.error("تعذر التحميل: " + error.message);
    else setRows((data as any) ?? []);
    setFetching(false);
  };

  useEffect(() => {
    if (!loading && canAccess) load();
  }, [loading, canAccess]);

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.customer_full_name, r.customer_phone, r.customer_email, r.business_name, r.id]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
      );
    }
    return list;
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const by = (s: string) => rows.filter((r) => r.status === s);
    const pending = by("pending");
    const confirmed = by("confirmed");
    const cancelled = by("cancelled");
    const expired = by("expired");
    const sum = (arr: BookingRow[], k: "total_price" | "units_count" | "total_area" | "paid_amount") =>
      arr.reduce((a, b) => a + (Number(b[k]) || 0), 0);
    const now = Date.now();
    const expiringSoon = pending.filter((r) => {
      const t = new Date(r.expires_at).getTime() - now;
      return t > 0 && t <= 12 * 3600 * 1000;
    }).length;
    const total = rows.length;
    const confirmRate = total ? Math.round((confirmed.length / total) * 100) : 0;
    const confirmedRevenue = sum(confirmed, "total_price");
    const collected = sum(confirmed, "paid_amount");
    const remaining = Math.max(0, confirmedRevenue - collected);
    const collectionRate = confirmedRevenue ? Math.round((collected / confirmedRevenue) * 100) : 0;
    return {
      total,
      pending: pending.length,
      confirmed: confirmed.length,
      cancelled: cancelled.length,
      expired: expired.length,
      expiringSoon,
      confirmRate,
      confirmedRevenue,
      collected,
      remaining,
      collectionRate,
      pendingRevenue: sum(pending, "total_price"),
      totalUnits: sum(rows, "units_count"),
      confirmedUnits: sum(confirmed, "units_count"),
      totalArea: sum(rows, "total_area"),
    };
  }, [rows]);

  const extendExpiry = async (id: string) => {
    const input = window.prompt("كم ساعة تريد إضافتها لمدة الحجز؟", "24");
    if (!input) return;
    const hours = parseInt(input, 10);
    if (!Number.isFinite(hours) || hours <= 0) {
      toast.error("أدخل عدد ساعات صحيح");
      return;
    }
    const { data, error } = await supabase.rpc("extend_booking_expiry" as any, {
      _booking_id: id,
      _hours: hours,
    });
    if (error) toast.error("فشل التمديد: " + error.message);
    else {
      toast.success(`تم التمديد ${hours} ساعة`);
      load();
    }
  };

  const setPaidAmount = async (b: BookingRow) => {
    const def = String(b.paid_amount || "");
    const input = window.prompt(
      `المبلغ المدفوع من العميل (الإجمالي: ${Number(b.total_price).toLocaleString("en-US")} ر.س)`,
      def
    );
    if (input === null) return;
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("أدخل مبلغًا صحيحًا");
      return;
    }
    const { error } = await supabase.rpc("set_booking_paid_amount" as any, {
      _booking_id: b.id,
      _paid_amount: amount,
    });
    if (error) toast.error("فشل الحفظ: " + error.message);
    else {
      toast.success("تم تحديث المبلغ المدفوع");
      load();
    }
  };

  const confirmBooking = async (b: BookingRow) => {
    const input = window.prompt(
      `أدخل المبلغ المدفوع من العميل (الإجمالي: ${Number(b.total_price).toLocaleString("en-US")} ر.س)\nاتركها 0 إذا لم يُدفع شيء بعد`,
      "0"
    );
    if (input === null) return;
    const amount = Number(input);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("أدخل مبلغًا صحيحًا");
      return;
    }
    const { error } = await supabase.rpc("confirm_booking" as any, {
      _booking_id: b.id,
      _paid_amount: amount,
    });
    if (error) toast.error("فشل التأكيد: " + error.message);
    else {
      toast.success(`تم التأكيد ونقل الوحدات للمؤجرين${amount > 0 ? ` • مدفوع ${amount.toLocaleString("en-US")} ر.س` : ""}`);
      load();
    }
  };

  const cancelBooking = async (id: string) => {
    const { error } = await supabase.rpc("cancel_booking", { _booking_id: id });
    if (error) toast.error("فشل التحديث: " + error.message);
    else {
      toast.success("تم الإلغاء وإرجاع الوحدات");
      load();
    }
  };

  if (!loading && !user) {
    navigate("/auth");
    return null;
  }
  if (!loading && user && !canAccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container-tight py-16">
          <div className="mx-auto max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <Lock className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 font-display text-xl font-bold">لا تملك صلاحية الوصول</h2>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <main className="container-tight py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarRange className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold sm:text-2xl">الحجوزات</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">{rows.length} حجز</p>
            </div>
          </div>
          {isAdmin && (
            <Link
              to="/admin"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary sm:px-4 sm:text-sm"
            >
              <ArrowRight className="h-4 w-4" /> رجوع
            </Link>
          )}
        </div>

        {!fetching && rows.length > 0 && (
          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard
              title="إجمالي الحجوزات"
              value={fmtNum(stats.total)}
              hint={`${stats.totalUnits} وحدة • ${fmtNum(Math.round(stats.totalArea))} م²`}
              Icon={CalendarRange}
              tone="primary"
            />
            <StatCard
              title="قيد المراجعة"
              value={fmtNum(stats.pending)}
              hint={stats.expiringSoon ? `${stats.expiringSoon} ينتهي خلال 12 ساعة` : "لا يوجد على وشك الانتهاء"}
              Icon={Clock}
              tone="amber"
            />
            <StatCard
              title="مؤكدة"
              value={fmtNum(stats.confirmed)}
              hint={`نسبة التأكيد ${stats.confirmRate}%`}
              Icon={CheckCircle2}
              tone="emerald"
            />
            <StatCard
              title="ملغية / منتهية"
              value={fmtNum(stats.cancelled + stats.expired)}
              hint={`${stats.cancelled} ملغي • ${stats.expired} منتهي`}
              Icon={XCircle}
              tone="rose"
            />
            <StatCard
              title="إيرادات مؤكدة"
              value={`${fmtNum(stats.confirmedRevenue)} ر.س`}
              hint={`${stats.confirmedUnits} وحدة مؤجَّرة`}
              Icon={Wallet}
              tone="emerald"
            />
            <StatCard
              title="المحصَّل فعلياً"
              value={`${fmtNum(stats.collected)} ر.س`}
              hint={`${stats.collectionRate}% من المؤكد • متبقي ${fmtNum(stats.remaining)}`}
              Icon={Wallet}
              tone="emerald"
            />
            <StatCard
              title="متوقع (قيد المراجعة)"
              value={`${fmtNum(stats.pendingRevenue)} ر.س`}
              hint="من الحجوزات المعلّقة"
              Icon={TrendingUp}
              tone="primary"
            />
            <StatCard
              title="إجمالي الوحدات"
              value={fmtNum(stats.totalUnits)}
              hint={`${fmtNum(Math.round(stats.totalArea))} م² إجمالاً`}
              Icon={Layers}
              tone="primary"
            />
            <StatCard
              title="على وشك الانتهاء"
              value={fmtNum(stats.expiringSoon)}
              hint="معلّقة خلال 12 ساعة"
              Icon={Hourglass}
              tone="amber"
            />
          </div>
        )}

        {isAdmin && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex flex-1 min-w-[200px] items-center gap-2 rounded-xl border border-border bg-card p-2">
              <Search className="mr-2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم، الهاتف، الإيميل، المعرّف..."
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
              {(["all", "pending", "confirmed", "cancelled", "expired"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    statusFilter === s ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                  }`}
                >
                  {s === "all" ? "الكل" : STATUS[s].label}
                </button>
              ))}
            </div>
          </div>
        )}

        {fetching ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">جارِ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">لا توجد حجوزات</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((b) => {
              const st = STATUS[b.status] ?? STATUS.pending;
              const StIcon = st.Icon;
              return (
                <div key={b.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-lg font-bold">{b.customer_full_name}</div>
                      {b.business_name && (
                        <div className="text-sm text-muted-foreground">{b.business_name}</div>
                      )}
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">#{b.id.slice(0, 8)}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${st.cls}`}>
                      <StIcon className="h-3 w-3" />
                      {st.label}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span dir="ltr">{b.customer_phone}</span>
                    </div>
                    {b.customer_email && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span dir="ltr" className="truncate">{b.customer_email}</span>
                      </div>
                    )}
                    <div className="text-muted-foreground">
                      التاريخ: {new Date(b.created_at).toLocaleDateString("ar-EG-u-nu-latn")}
                    </div>
                    <div className="text-muted-foreground">
                      الوحدات: <span className="num font-semibold text-foreground">{b.units_count}</span>
                    </div>
                    <div className="text-muted-foreground">
                      المساحة: <span className="num font-semibold text-foreground">{fmtNum(b.total_area)} م²</span>
                    </div>
                    <div className="text-muted-foreground">
                      السعر: <span className="num font-semibold text-foreground">{Number(b.total_price).toLocaleString("en-US")}</span> ر.س
                    </div>
                    <div className="text-muted-foreground">
                      المدفوع: <span className={`num font-semibold ${Number(b.paid_amount) > 0 ? "text-emerald-600" : "text-foreground"}`}>{Number(b.paid_amount || 0).toLocaleString("en-US")}</span> ر.س
                    </div>
                  </div>

                  {b.status === "confirmed" && (
                    <div className="mt-2 rounded-lg bg-emerald-500/10 p-2 text-center text-xs font-semibold text-emerald-700">
                      ✅ مؤكد • مدفوع <span className="num">{Number(b.paid_amount || 0).toLocaleString("en-US")}</span> من <span className="num">{Number(b.total_price).toLocaleString("en-US")}</span> ر.س
                      {Number(b.total_price) - Number(b.paid_amount || 0) > 0 && (
                        <> • متبقي <span className="num">{(Number(b.total_price) - Number(b.paid_amount || 0)).toLocaleString("en-US")}</span></>
                      )}
                    </div>
                  )}

                  {b.status === "pending" && b.expires_at && (
                    (() => {
                      const ms = new Date(b.expires_at).getTime() - Date.now();
                      const expired = ms <= 0;
                      const hours = Math.max(0, Math.floor(ms / 3600000));
                      const mins = Math.max(0, Math.floor((ms % 3600000) / 60000));
                      return (
                        <div className={`mt-2 rounded-lg p-2 text-center text-xs font-semibold ${expired ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-700"}`}>
                          {expired
                            ? "⏰ انتهت صلاحية الحجز (48 ساعة)"
                            : <>⏰ ينتهي خلال <span className="num">{hours}</span> س <span className="num">{mins}</span> د</>}
                        </div>
                      );
                    })()
                  )}

                  {b.booking_units && b.booking_units.length > 0 && (
                    <div className="mt-3 space-y-1 rounded-lg bg-secondary/50 p-2 text-xs">
                      {b.booking_units.map((u, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span>مبنى {u.building_number} - وحدة {u.unit_number}{u.unit_type ? ` (${u.unit_type})` : ""}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {b.notes && (
                    <p className="mt-2 rounded-lg bg-secondary p-2 text-xs text-muted-foreground">{b.notes}</p>
                  )}

                  {isAdmin && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {b.offer_image_url && (
                        <a
                          href={b.offer_image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
                        >
                          <FileImage className="h-3.5 w-3.5" /> عرض التأجير
                        </a>
                      )}
                      {b.status === "pending" && (
                        <>
                          <button
                            onClick={() => confirmBooking(b)}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500/10 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20"
                          >
                            <CheckCircle2 className="h-3 w-3" /> تأكيد ونقل للمؤجرين
                          </button>
                          <button
                            onClick={() => cancelBooking(b.id)}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-destructive/10 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
                          >
                            <XCircle className="h-3 w-3" /> إلغاء
                          </button>
                        </>
                      )}
                      {(b.status === "confirmed" || b.status === "pending") && (
                        <button
                          onClick={() => setPaidAmount(b)}
                          className="flex items-center justify-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          {Number(b.paid_amount) > 0 ? "تعديل الدفعة" : "إضافة دفعة"}
                        </button>
                      )}
                      {(b.status === "pending" || b.status === "expired") && (
                        <button
                          onClick={() => extendExpiry(b.id)}
                          className="flex items-center justify-center gap-1 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-500/20"
                        >
                          <TimerReset className="h-3.5 w-3.5" /> تمديد المدة
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default AdminBookings;
