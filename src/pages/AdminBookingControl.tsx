import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Lock, LockOpen, Building2, Map as MapIcon, BellRing, Clock, AlertTriangle, CheckCircle2, Send, Loader2 } from "lucide-react";
import { BOOKING_ACTIVITIES, buildingInActivity } from "@/lib/bookingActivities";
import serviceMap from "@/assets/activity-map-service.png";
import smithingMap from "@/assets/activity-map-smithing.png.asset.json";
import carpentryMap from "@/assets/activity-map-carpentry.png.asset.json";
import shopsMap from "@/assets/activity-map-shops.png.asset.json";
import carShowroomsMap from "@/assets/activity-map-car-showrooms.png.asset.json";
import partsMap from "@/assets/activity-map-parts.png.asset.json";

const PLAN: Record<string, string> = {
  service: serviceMap,
  smithing: (smithingMap as { url: string }).url,
  carpentry: (carpentryMap as { url: string }).url,
  shops: (shopsMap as { url: string }).url,
  "car-showrooms": (carShowroomsMap as { url: string }).url,
  parts: (partsMap as { url: string }).url,
  tires: (partsMap as { url: string }).url,
};

interface B { id: string; number: number; type: string; booking_enabled: boolean }
interface U { building_number: number; status: string }
interface Bk { id: string; customer_full_name: string; customer_phone: string; business_name: string | null; status: string; total_price: number; units_count: number; created_at: string; expires_at: string }

type Tab = "buildings" | "activities" | "follow";

const STATUS: Record<string, string> = { pending: "معلّق", confirmed: "مؤكد", cancelled: "ملغي", expired: "منتهي" };

const AdminBookingControl = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isManager, loading } = useAuth();
  const canAccess = isAdmin || isManager;
  const [tab, setTab] = useState<Tab>("buildings");
  const [buildings, setBuildings] = useState<B[]>([]);
  const [units, setUnits] = useState<U[]>([]);
  const [bookings, setBookings] = useState<Bk[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const [b, u, bk] = await Promise.all([
      supabase.from("buildings").select("id,number,type,booking_enabled").order("number"),
      supabase.from("units").select("building_number,status").limit(5000),
      supabase.from("bookings").select("id,customer_full_name,customer_phone,business_name,status,total_price,units_count,created_at,expires_at").gte("created_at", since).order("created_at", { ascending: false }).limit(200),
    ]);
    if (b.error || u.error || bk.error) toast.error("تعذر تحميل بعض البيانات");
    setBuildings((b.data as B[]) ?? []);
    setUnits((u.data as U[]) ?? []);
    setBookings((bk.data as Bk[]) ?? []);
  };
  useEffect(() => { if (canAccess) load(); }, [canAccess]);

  const stats = useMemo(() => {
    const m = new Map<number, { total: number; available: number; reserved: number; rented: number }>();
    for (const u of units) {
      const s = m.get(u.building_number) ?? { total: 0, available: 0, reserved: 0, rented: 0 };
      s.total++;
      if (u.status === "available") s.available++; else if (u.status === "rented") s.rented++; else s.reserved++;
      m.set(u.building_number, s);
    }
    return m;
  }, [units]);

  const toggle = async (b: B) => {
    if (!isAdmin) { toast.error("القفل والفتح للأدمن فقط"); return; }
    const next = !b.booking_enabled;
    if (!confirm(next ? `فتح مبنى ${b.number} للحجز؟` : `قفل مبنى ${b.number} من الحجز؟ مش هيظهر للعملاء.`)) return;
    setBusy(b.id);
    const { error } = await supabase.from("buildings").update({ booking_enabled: next }).eq("id", b.id);
    setBusy(null);
    if (error) { toast.error("فشل التعديل: " + error.message); return; }
    toast.success(next ? `مبنى ${b.number} اتفتح للحجز` : `مبنى ${b.number} اتقفل من الحجز`);
    setBuildings((xs) => xs.map((x) => (x.id === b.id ? { ...x, booking_enabled: next } : x)));
  };

  const resend = async (bk: Bk) => {
    if (!isAdmin) return;
    setBusy(bk.id);
    const { data: bu } = await supabase.from("booking_units").select("building_number,unit_number,unit_type,area,price,activity").eq("booking_id", bk.id);
    const { error } = await supabase.functions.invoke("telegram-notify", {
      body: {
        booking_id: bk.id,
        customer: { fullName: bk.customer_full_name, phone: bk.customer_phone, business: bk.business_name ?? undefined },
        units: (bu ?? []).map((u) => ({ buildingNumber: u.building_number, unitNumber: u.unit_number, unitType: u.unit_type, area: Number(u.area), price: Number(u.price), activity: u.activity })),
      },
    });
    setBusy(null);
    if (error) toast.error("فشل إرسال التنبيه لتيليجرام"); else toast.success("اتبعت التنبيه على تيليجرام");
  };

  if (!loading && !user) { navigate("/auth"); return null; }
  if (!loading && user && !canAccess) {
    return (
      <div className="min-h-screen bg-background"><Header />
        <main className="container-tight py-16"><div className="mx-auto max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <Lock className="mx-auto h-12 w-12 text-destructive" /><h2 className="mt-4 font-display text-xl font-bold">لا تملك صلاحية الوصول</h2>
        </div></main><Footer /></div>
    );
  }

  const now = Date.now();
  const pending = bookings.filter((b) => b.status === "pending");
  const expiringSoon = pending.filter((b) => new Date(b.expires_at).getTime() - now < 12 * 36e5);
  const closed = buildings.filter((b) => !b.booking_enabled).length;

  const tabs: { k: Tab; label: string; Icon: typeof Building2 }[] = [
    { k: "buildings", label: "قفل وفتح المباني", Icon: Building2 },
    { k: "activities", label: "الأنشطة والمخططات", Icon: MapIcon },
    { k: "follow", label: "متابعة الحجوزات", Icon: BellRing },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <main className="container-tight py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-bold sm:text-2xl">التحكم في الحجز</h1>
            <p className="text-xs text-muted-foreground sm:text-sm">{buildings.length} مبنى • {closed} مقفول • {pending.length} حجز معلّق</p>
          </div>
          <Link to="/admin" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-secondary"><ArrowRight className="h-4 w-4" /> رجوع</Link>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["مباني مفتوحة", buildings.length - closed, CheckCircle2],
            ["مباني مقفولة", closed, Lock],
            ["حجوزات معلّقة", pending.length, Clock],
            ["تنتهي خلال 12 ساعة", expiringSoon.length, AlertTriangle],
          ].map(([l, v, I]) => {
            const Icon = I as typeof Lock;
            return (
              <div key={l as string} className="rounded-2xl border border-border bg-card p-4">
                <Icon className="h-5 w-5 text-primary" />
                <div className="mt-2 font-display text-2xl font-bold tabular-nums">{v as number}</div>
                <div className="text-xs text-muted-foreground">{l as string}</div>
              </div>
            );
          })}
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto">
          {tabs.map(({ k, label, Icon }) => (
            <button key={k} onClick={() => setTab(k)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium ${tab === k ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-secondary"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "buildings" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {buildings.map((b) => {
              const s = stats.get(b.number) ?? { total: 0, available: 0, reserved: 0, rented: 0 };
              return (
                <div key={b.id} className={`rounded-2xl border p-4 ${b.booking_enabled ? "border-border bg-card" : "border-destructive/40 bg-destructive/5"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-display text-lg font-bold">مبنى {b.number}</div>
                      <div className="truncate text-xs text-muted-foreground">{b.type}</div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.booking_enabled ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>{b.booking_enabled ? "مفتوح" : "مقفول"}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1 text-center text-xs">
                    <div><div className="font-bold tabular-nums">{s.total}</div><div className="text-muted-foreground">الكل</div></div>
                    <div><div className="font-bold tabular-nums">{s.available}</div><div className="text-muted-foreground">متاح</div></div>
                    <div><div className="font-bold tabular-nums">{s.reserved}</div><div className="text-muted-foreground">محجوز</div></div>
                    <div><div className="font-bold tabular-nums">{s.rented}</div><div className="text-muted-foreground">مؤجر</div></div>
                  </div>
                  <button disabled={busy === b.id || !isAdmin} onClick={() => toggle(b)} className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50 ${b.booking_enabled ? "border border-destructive/40 text-destructive hover:bg-destructive/10" : "bg-primary text-primary-foreground hover:opacity-90"}`}>
                    {busy === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : b.booking_enabled ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
                    {b.booking_enabled ? "اقفل من الحجز" : "افتح للحجز"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === "activities" && (
          <div className="grid gap-4 md:grid-cols-2">
            {BOOKING_ACTIVITIES.map((a) => {
              const expected = a.buildings ? [...a.buildings] : buildings.filter((b) => buildingInActivity(b, a.key)).map((b) => b.number);
              const registered = new Set(buildings.map((b) => b.number));
              const open = expected.filter((n) => buildings.find((b) => b.number === n)?.booking_enabled);
              const missing = expected.filter((n) => !registered.has(n));
              const closedHere = expected.filter((n) => registered.has(n) && !open.includes(n));
              const avail = open.reduce((t, n) => t + (stats.get(n)?.available ?? 0), 0);
              return (
                <div key={a.key} className="overflow-hidden rounded-2xl border border-border bg-card">
                  {PLAN[a.key] ? <img src={PLAN[a.key]} alt={`مخطط ${a.title}`} loading="lazy" className="aspect-[2/1] w-full bg-muted object-contain" />
                    : <div className="flex aspect-[4/1] items-center justify-center bg-muted text-xs text-muted-foreground">لا يوجد مخطط لسه</div>}
                  <div className="p-4">
                    <div className="font-display font-bold">{a.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{open.length} مبنى مفتوح • {avail} وحدة متاحة</div>
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                      {open.map((n) => <span key={n} className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{n}</span>)}
                      {closedHere.map((n) => <span key={n} className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">{n} مقفول</span>)}
                      {missing.map((n) => <span key={n} className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{n} غير مسجل</span>)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "follow" && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border p-4 text-sm text-muted-foreground">حجوزات آخر 30 يوم — تقدر تعيد إرسال تنبيه أي حجز لتيليجرام لو ما وصلكش.</div>
            {bookings.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">مفيش حجوزات في آخر 30 يوم</div> : (
              <div className="divide-y divide-border">
                {bookings.map((bk) => {
                  const left = new Date(bk.expires_at).getTime() - now;
                  const soon = bk.status === "pending" && left < 12 * 36e5;
                  return (
                    <div key={bk.id} className={`flex flex-wrap items-center justify-between gap-3 p-4 ${soon ? "bg-destructive/5" : ""}`}>
                      <div className="min-w-0">
                        <div className="font-medium">{bk.business_name || bk.customer_full_name}</div>
                        <div className="text-xs text-muted-foreground"><span dir="ltr">{bk.customer_phone}</span> • {bk.units_count} وحدة • {Number(bk.total_price).toLocaleString("ar-SA")} ريال • {new Date(bk.created_at).toLocaleString("ar-EG")}</div>
                        {bk.status === "pending" && <div className={`mt-1 text-xs ${soon ? "text-destructive" : "text-muted-foreground"}`}>{left > 0 ? `ينتهي خلال ${Math.ceil(left / 36e5)} ساعة` : "انتهت مهلته"}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{STATUS[bk.status] ?? bk.status}</span>
                        {isAdmin && <button disabled={busy === bk.id} onClick={() => resend(bk)} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-50">
                          {busy === bk.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} تنبيه تيليجرام
                        </button>}
                        <Link to="/admin/bookings" className="rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-secondary">التفاصيل</Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default AdminBookingControl;
