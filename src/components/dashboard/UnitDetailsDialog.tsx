import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Unit } from "@/data/types";
import { toast } from "sonner";
import {
  Building2, Calendar, FileText, Phone, User, Briefcase, Hash,
  CheckCircle2, XCircle, Clock, AlertCircle, Wallet, Ruler, Tag,
  History, Lock, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UnitFilesPanel } from "./UnitFilesPanel";



const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US").format(Math.round(Number(n ?? 0)));
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("ar-SA-u-nu-latn", {
    dateStyle: "medium", timeStyle: "short",
  });
};

type Props = {
  unit: Unit | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

type BookingRow = {
  id: string;
  offer_number: string | null;
  status: string;
  customer_full_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  business_name: string | null;
  cr_number: string | null;
  total_price: number;
  paid_amount: number;
  units_count: number;
  payment_plan: string | null;
  created_at: string;
  expires_at: string | null;
  notes: string | null;
};

type TenantRow = {
  id: string;
  tenant_name: string;
  business_name: string | null;
  activity_type: string | null;
  phone: string | null;
  notes: string | null;
  start_date: string | null;
  end_date: string | null;
  cr_number: string | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  amount: number;
  paid_amount: number;
  paid: boolean;
  paid_at: string | null;
  payment_method: string | null;
  customer_name: string | null;
  notes: string | null;
  created_at: string;
};

const STATUS_META: Record<string, { label: string; cls: string; Icon: any }> = {
  pending:   { label: "قيد الانتظار", cls: "bg-amber-100 text-amber-800 border-amber-300", Icon: Clock },
  confirmed: { label: "مؤكد",        cls: "bg-emerald-100 text-emerald-800 border-emerald-300", Icon: CheckCircle2 },
  cancelled: { label: "ملغي",        cls: "bg-rose-100 text-rose-800 border-rose-300", Icon: XCircle },
  expired:   { label: "منتهي",       cls: "bg-slate-100 text-slate-800 border-slate-300", Icon: AlertCircle },
};

const UNIT_STATUS_META = {
  rented:    { label: "مؤجر",  cls: "bg-primary/10 text-primary border-primary/30" },
  reserved:  { label: "محجوز", cls: "bg-amber-500/10 text-amber-700 border-amber-300" },
  available: { label: "متاح",   cls: "bg-emerald-500/10 text-emerald-700 border-emerald-300" },
} as const;

export function UnitDetailsDialog({ unit, open, onOpenChange }: Props) {
  const { isAdmin, isManager } = useAuth();
  const hasAdminAccess = isAdmin || isManager;
  const canEdit = isAdmin;

  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [tenantAccountId, setTenantAccountId] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!open || !unit?.id || !hasAdminAccess) {
      setBookings([]); setTenants([]); setInvoices([]); setTenantAccountId(null);
      return;
    }
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const [bRes, tRes, iRes, taRes] = await Promise.all([
          supabase
            .from("booking_units")
            .select("booking_id, bookings:booking_id (id, offer_number, status, customer_full_name, customer_phone, customer_email, business_name, cr_number, total_price, paid_amount, units_count, payment_plan, created_at, expires_at, notes)")
            .eq("unit_id", unit.id),
          supabase
            .from("tenants")
            .select("id, tenant_name, business_name, activity_type, phone, notes, start_date, end_date, cr_number")
            .eq("unit_id", unit.id)
            .order("start_date", { ascending: false }),
          supabase
            .from("invoices")
            .select("id, invoice_number, amount, paid_amount, paid, paid_at, payment_method, customer_name, notes, created_at")
            .eq("unit_id", unit.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("tenant_account_units")
            .select("tenant_account_id")
            .eq("unit_id", unit.id)
            .limit(1)
            .maybeSingle(),
        ]);
        if (cancel) return;
        const bRows: BookingRow[] = (bRes.data ?? [])
          .map((r: any) => r.bookings)
          .filter(Boolean)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setBookings(bRows);
        setTenants((tRes.data ?? []) as any);
        setInvoices((iRes.data ?? []) as any);
        setTenantAccountId((taRes.data as any)?.tenant_account_id ?? null);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, unit?.id, hasAdminAccess, reloadTick]);


  if (!unit) return null;

  const uMeta = UNIT_STATUS_META[unit.status];

  // aggregates
  const totalBookings = bookings.length;
  const confirmedCount = bookings.filter((b) => b.status === "confirmed").length;
  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const cancelledCount = bookings.filter((b) => b.status === "cancelled").length;
  const expiredCount = bookings.filter((b) => b.status === "expired").length;
  const totalPaid = bookings.reduce((s, b) => s + Number(b.paid_amount || 0), 0)
                  + invoices.filter((i) => i.paid).reduce((s, i) => s + Number(i.paid_amount || 0), 0);
  const currentTenant = tenants[0] ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-hidden p-0" dir="rtl">
        {/* Header */}
        <div className="border-b bg-gradient-to-l from-primary to-primary/85 p-5 text-primary-foreground">
          <DialogHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={cn("border", uMeta.cls)}>{uMeta.label}</Badge>
              {unit.unitType && (
                <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
                  {unit.unitType}
                </Badge>
              )}
              <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
                <Tag className="ml-1 h-3 w-3" /> {unit.activity ?? "—"}
              </Badge>
            </div>
            <DialogTitle className="font-display text-2xl font-extrabold text-white">
              مبنى <span className="num">{unit.buildingNumber}</span> · وحدة <span className="num">{unit.unitNumber}</span>
            </DialogTitle>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs opacity-90">
              <span className="flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> <span className="num">{unit.area}</span> م²</span>
              <span className="flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> <span className="num">{fmt(unit.price)}</span> ر.س / سنة</span>
              <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {unit.buildingType}</span>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[calc(92vh-150px)]">
          <div className="p-5">
            {!hasAdminAccess ? (
              <div className="rounded-xl border border-dashed bg-muted/40 p-8 text-center">
                <Lock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <h3 className="font-display text-base font-bold">سجل الوحدة محمي</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  تفاصيل الحجوزات والمستأجر والفواتير متاحة للمسؤولين فقط.
                </p>
              </div>
            ) : (
              <>
                {/* Summary mini KPIs */}
                <div className="mb-4 grid gap-2 sm:grid-cols-4">
                  <SummaryCard icon={<History className="h-4 w-4" />} label="إجمالي الحجوزات" value={totalBookings} loading={loading} />
                  <SummaryCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="مؤكد" value={confirmedCount} loading={loading} />
                  <SummaryCard icon={<Clock className="h-4 w-4 text-amber-600" />} label="قيد الانتظار" value={pendingCount} loading={loading} />
                  <SummaryCard icon={<XCircle className="h-4 w-4 text-rose-600" />} label="ملغي / منتهي" value={cancelledCount + expiredCount} loading={loading} />
                </div>

                <Tabs defaultValue="overview" dir="rtl">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
                    <TabsTrigger value="bookings">الحجوزات ({totalBookings})</TabsTrigger>
                    <TabsTrigger value="tenant">المستأجر ({tenants.length})</TabsTrigger>
                    <TabsTrigger value="invoices">الفواتير ({invoices.length})</TabsTrigger>
                    <TabsTrigger value="files">الملفات</TabsTrigger>
                  </TabsList>

                  {/* OVERVIEW */}
                  <TabsContent value="overview" className="mt-4 space-y-3">
                    <InfoGrid
                      rows={[
                        ["المبنى", `رقم ${unit.buildingNumber} — ${unit.buildingType}`],
                        ["رقم الوحدة", String(unit.unitNumber)],
                        ["النوع", unit.unitType ?? "—"],
                        ["المساحة", `${unit.area} م²`],
                        ["النشاط", unit.activity ?? "—"],
                        ["الإيجار السنوي", `${fmt(unit.price)} ر.س`],
                        ["الحالة الحالية", uMeta.label],
                        ["إجمالي مرات الحجز", String(totalBookings)],
                        ["إجمالي المحصّل", `${fmt(totalPaid)} ر.س`],
                      ]}
                    />
                    {currentTenant && (
                      <div className="rounded-xl border bg-gradient-to-b from-primary/5 to-card p-4">
                        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-primary">
                          <User className="h-4 w-4" /> المستأجر الحالي
                        </div>
                        <div className="font-display text-base font-extrabold">{currentTenant.tenant_name}</div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {currentTenant.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> <span className="num">{currentTenant.phone}</span></span>}
                          {currentTenant.business_name && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> {currentTenant.business_name}</span>}
                          {currentTenant.cr_number && <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> <span className="num">{currentTenant.cr_number}</span></span>}
                          {currentTenant.start_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> منذ {fmtDate(currentTenant.start_date)}</span>}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* BOOKINGS */}
                  <TabsContent value="bookings" className="mt-4 space-y-3">
                    {loading ? (
                      <SkeletonList />
                    ) : bookings.length === 0 ? (
                      <EmptyState text="لا توجد حجوزات سابقة على هذه الوحدة" />
                    ) : (
                      bookings.map((b) => {
                        const m = STATUS_META[b.status] ?? STATUS_META.pending;
                        const remaining = Number(b.total_price || 0) - Number(b.paid_amount || 0);
                        return (
                          <div key={b.id} className="rounded-xl border bg-card p-4 transition hover:border-accent hover:shadow-sm">
                            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className={cn("border", m.cls)}>
                                    <m.Icon className="ml-1 h-3 w-3" /> {m.label}
                                  </Badge>
                                  {b.offer_number && (
                                    <span className="num text-xs font-mono text-muted-foreground">#{b.offer_number}</span>
                                  )}
                                </div>
                                <div className="mt-1.5 font-display text-sm font-bold">{b.customer_full_name}</div>
                                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                  {b.customer_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /><span className="num">{b.customer_phone}</span></span>}
                                  {b.business_name && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{b.business_name}</span>}
                                  {b.cr_number && <span className="flex items-center gap-1"><Hash className="h-3 w-3" /><span className="num">{b.cr_number}</span></span>}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="num text-sm font-bold">{fmt(b.total_price)} ر.س</div>
                                <div className="text-[10px] text-muted-foreground">
                                  مدفوع <span className="num font-semibold text-emerald-700">{fmt(b.paid_amount)}</span>
                                  {" · "}متبقي <span className="num font-semibold text-rose-700">{fmt(remaining)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {fmtDate(b.created_at)}</span>
                              {b.expires_at && <span>ينتهي: {fmtDate(b.expires_at)}</span>}
                              <span>وحدات: <span className="num font-semibold">{b.units_count}</span></span>
                              {b.payment_plan && <span>خطة: {b.payment_plan}</span>}
                            </div>
                            {b.notes && (
                              <div className="mt-2 rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">{b.notes}</div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </TabsContent>

                  {/* TENANT */}
                  <TabsContent value="tenant" className="mt-4 space-y-3">
                    {loading ? (
                      <SkeletonList />
                    ) : tenants.length === 0 ? (
                      <EmptyState text="لم يتم تسجيل مستأجر لهذه الوحدة" />
                    ) : (
                      tenants.map((t) => (
                        <div key={t.id} className="rounded-xl border bg-card p-4">
                          <div className="font-display text-base font-extrabold">{t.tenant_name}</div>
                          <div className="mt-2 grid gap-y-1 text-xs sm:grid-cols-2">
                            {t.phone && <Row label="الجوال"><span className="num">{t.phone}</span></Row>}
                            {t.business_name && <Row label="النشاط التجاري">{t.business_name}</Row>}
                            {t.activity_type && <Row label="نوع النشاط">{t.activity_type}</Row>}
                            {t.cr_number && <Row label="السجل التجاري"><span className="num">{t.cr_number}</span></Row>}
                            {t.start_date && <Row label="تاريخ البدء">{fmtDate(t.start_date)}</Row>}
                            {t.end_date && <Row label="تاريخ الانتهاء">{fmtDate(t.end_date)}</Row>}
                          </div>
                          {t.notes && (
                            <div className="mt-3 rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">{t.notes}</div>
                          )}
                        </div>
                      ))
                    )}
                  </TabsContent>

                  {/* INVOICES */}
                  <TabsContent value="invoices" className="mt-4 space-y-3">
                    {canEdit && (
                      <NewInvoiceForUnit
                        unitId={unit.id!}
                        tenantAccountId={tenantAccountId}
                        tenantName={currentTenant?.tenant_name ?? null}
                        onCreated={() => setReloadTick((t) => t + 1)}
                      />
                    )}

                    {loading ? (
                      <SkeletonList />
                    ) : invoices.length === 0 ? (
                      <EmptyState text="لا توجد فواتير مرتبطة بهذه الوحدة" />
                    ) : (
                      invoices.map((i) => (
                        <div key={i.id} className="rounded-xl border bg-card p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary" />
                              <span className="num font-mono text-xs font-bold">{i.invoice_number}</span>
                              <Badge className={cn("border text-[10px]",
                                i.paid
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-amber-100 text-amber-800 border-amber-300"
                              )}>
                                {i.paid ? "مدفوعة" : "غير مدفوعة"}
                              </Badge>
                            </div>
                            <div className="text-right">
                              <div className="num text-sm font-bold">{fmt(i.amount)} ر.س</div>
                              {i.paid && <div className="text-[10px] text-emerald-700">دفعت {fmtDate(i.paid_at)}</div>}
                            </div>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                            {i.customer_name && <span>{i.customer_name}</span>}
                            {i.payment_method && <span>طريقة: {i.payment_method}</span>}
                            <span>تاريخ: {fmtDate(i.created_at)}</span>
                          </div>
                          {i.notes && <div className="mt-1 text-[10px] text-muted-foreground">{i.notes}</div>}
                        </div>
                      ))
                    )}
                  </TabsContent>

                  {/* FILES */}
                  <TabsContent value="files" className="mt-4">
                    <UnitFilesPanel unitId={unit.id!} />
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: number; loading: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">{icon} {label}</div>
      <div className="num mt-1 text-lg font-extrabold">
        {loading ? <Skeleton className="inline-block h-5 w-8" /> : value}
      </div>
    </div>
  );
}

function InfoGrid({ rows }: { rows: [string, string][] }) {
  return (
    <div className="grid gap-y-1 rounded-xl border bg-card p-4 text-xs sm:grid-cols-2 sm:gap-x-6">
      {rows.map(([k, v], i) => <Row key={i} label={k}>{v}</Row>)}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-1.5 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{children}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
    </div>
  );
}
