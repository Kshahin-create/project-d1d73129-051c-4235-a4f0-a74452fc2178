import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarRange, Lock, Search, ArrowRight, Phone, Mail, Building2, CheckCircle2, XCircle, Clock, FileImage } from "lucide-react";

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
  units_count: number;
  whatsapp_sent: boolean;
  offer_image_url: string | null;
  created_at: string;
  booking_units?: BookingUnitRow[];
}

const STATUS: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  pending: { label: "قيد المراجعة", cls: "bg-amber-500/10 text-amber-600", Icon: Clock },
  confirmed: { label: "مؤكد", cls: "bg-emerald-500/10 text-emerald-600", Icon: CheckCircle2 },
  cancelled: { label: "ملغي", cls: "bg-destructive/10 text-destructive", Icon: XCircle },
};

const AdminBookings = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isManager, loading } = useAuth();
  const canAccess = isAdmin || isManager;
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "confirmed" | "cancelled">("all");

  const load = async () => {
    setFetching(true);
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

  const updateStatus = async (id: string, status: "confirmed" | "cancelled") => {
    const rpc = status === "confirmed" ? "confirm_booking" : "cancel_booking";
    const { error } = await supabase.rpc(rpc, { _booking_id: id });
    if (error) toast.error("فشل التحديث: " + error.message);
    else {
      toast.success(status === "confirmed" ? "تم التأكيد ونقل الوحدات للمؤجرين" : "تم الإلغاء وإرجاع الوحدات");
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
          <Link
            to="/admin"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary sm:px-4 sm:text-sm"
          >
            <ArrowRight className="h-4 w-4" /> رجوع
          </Link>
        </div>

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
            {(["all", "pending", "confirmed", "cancelled"] as const).map((s) => (
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
                      المساحة: <span className="num font-semibold text-foreground">{Number(b.total_area)} م²</span>
                    </div>
                    <div className="text-muted-foreground">
                      السعر: <span className="num font-semibold text-foreground">{Number(b.total_price).toLocaleString("en-US")}</span> ر.س
                    </div>
                  </div>

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

                  {b.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => updateStatus(b.id, "confirmed")}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500/10 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20"
                      >
                        <CheckCircle2 className="h-3 w-3" /> تأكيد
                      </button>
                      <button
                        onClick={() => updateStatus(b.id, "cancelled")}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-destructive/10 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20"
                      >
                        <XCircle className="h-3 w-3" /> إلغاء
                      </button>
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
