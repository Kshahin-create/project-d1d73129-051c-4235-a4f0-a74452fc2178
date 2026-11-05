import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, LogOut, Building2, Lock, CheckCircle2, Search, Users, TrendingUp, X, History, SlidersHorizontal, FileSpreadsheet, FileText, FileDown } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { useBuildingsAndUnits } from "@/hooks/useBuildings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { exportUnitsToExcel, exportUnitsToCSV, exportUnitsToPDF } from "@/lib/exportUnits";
import { Button } from "@/components/ui/button";
import { UnitDetailsDialog } from "@/components/dashboard/UnitDetailsDialog";
import { unitStatusLabel } from "@/lib/unitStatus";
import type { Unit } from "@/data/types";
import { MaintenanceToggle } from "@/components/MaintenanceToggle";
import { UnitsMap } from "@/components/dashboard/UnitsMap";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface TenantForm {
  tenant_name: string;
  business_name: string;
  activity_type: string;
  phone: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { data, isLoading } = useBuildingsAndUnits();

  const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "rented" | "reserved" | "available">("all");
  const [search, setSearch] = useState("");
  const [editingUnit, setEditingUnit] = useState<{ id: string; unitNumber: number; building: number; wasRented: boolean; mode: "rent" | "reserve" } | null>(null);
  const [tenantForm, setTenantForm] = useState<TenantForm>({ tenant_name: "", business_name: "", activity_type: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [confirmRent, setConfirmRent] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<{ unitNumber: number; buildingNumber: number; status: "rented" | "reserved" } | null>(null);
  const [detailUnit, setDetailUnit] = useState<Unit | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);

  const buildings = data?.buildings ?? [];
  const units = data?.units ?? [];

  const buildingUnits = useMemo(() => {
    let list = selectedBuilding ? units.filter((u) => u.buildingNumber === selectedBuilding) : units;
    if (statusFilter !== "all") {
      list = list.filter((u) => u.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim();
      list = list.filter((u) => String(u.unitNumber).includes(q));
    }
    return list;
  }, [selectedBuilding, units, search, statusFilter]);

  const stats = useMemo(() => {
    const scope = buildingUnits;
    const total = scope.length;
    const rented = scope.filter((u) => u.status === "rented").length;
    const reserved = scope.filter((u) => u.status === "reserved").length;
    const available = scope.filter((u) => u.status === "available").length;
    const revenue = scope.filter((u) => u.status === "rented").reduce((s, u) => s + u.price, 0);
    return { total, rented, reserved, available, revenue };
  }, [buildingUnits]);

  // Auth gate (after hooks to keep hook order stable)
  if (!authLoading && !user) {
    navigate("/auth");
    return null;
  }
  if (!authLoading && user && !isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container-tight py-16">
          <div className="mx-auto max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <Lock className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 font-display text-xl font-bold">لا تملك صلاحية الوصول</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              هذا الحساب ليس لديه صلاحيات أدمن. تواصل مع المسؤول لمنحك الصلاحية.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">معرّف المستخدم:</p>
            <code className="mt-1 block break-all rounded bg-background px-2 py-1 text-[10px]">{user?.id}</code>
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate("/auth"); }}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium hover:border-primary/40"
            >
              <LogOut className="h-4 w-4" /> تسجيل الخروج
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }


  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const writeAuditLog = async (entry: {
    unit_id: string;
    building_number: number;
    unit_number: number;
    action: "rent" | "reserve" | "release" | "update";
    previous_status: string;
    new_status: string;
    reason: string;
    tenant_snapshot?: any;
  }) => {
    if (!user) return;
    await supabase.from("unit_audit_log").insert({
      ...entry,
      performed_by: user.id,
      performed_by_email: user.email ?? null,
    });
  };

  const openRentDialog = async (
    unitNumber: number,
    buildingNumber: number,
    currentStatus: string,
    mode: "rent" | "reserve" = "rent",
  ) => {
    const { data: u } = await supabase
      .from("units_status_read")
      .select("id")
      .eq("building_number", buildingNumber)
      .eq("unit_number", unitNumber)
      .maybeSingle();
    if (!u) return;
    setEditingUnit({
      id: u.id,
      unitNumber,
      building: buildingNumber,
      wasRented: currentStatus === "rented" || currentStatus === "reserved",
      mode,
    });
    const { data: t } = await supabase
      .from("tenants")
      .select("*")
      .eq("unit_id", u.id)
      .maybeSingle();
    setTenantForm({
      tenant_name: t?.tenant_name || "",
      business_name: t?.business_name || "",
      activity_type: t?.activity_type || "",
      phone: t?.phone || "",
    });
  };

  // Step 1: validate form, then open confirmation
  const requestRentConfirmation = () => {
    if (!editingUnit) return;
    if (!tenantForm.tenant_name.trim()) {
      toast.error("اسم المستأجر مطلوب");
      return;
    }
    setConfirmRent(true);
  };

  // Step 2: actually save after confirmation with reason
  const handleRentConfirmed = async (reason: string) => {
    if (!editingUnit) return;
    setSaving(true);
    try {
      throw new Error("الحجز والتأجير من طلب الحجز وسجل العقد فقط؛ افتح تفاصيل الوحدة");
      setConfirmRent(false);
      setEditingUnit(null);
      qc.invalidateQueries({ queryKey: ["buildings-units"] });
    } catch (err: any) {
      toast.error(err.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const handleReleaseConfirmed = async (reason: string) => {
    if (!releaseTarget) return;
    setSaving(true);
    try {
      const { data: u } = await supabase
        .from("units_status_read").select("id")
        .eq("building_number", releaseTarget.buildingNumber)
        .eq("unit_number", releaseTarget.unitNumber)
        .maybeSingle();
      if (!u) throw new Error("الوحدة غير موجودة");

      throw new Error("الإخلاء يتطلب انتهاء أو إنهاء العقد من تفاصيل الوحدة");
      setReleaseTarget(null);
      qc.invalidateQueries({ queryKey: ["buildings-units"] });
    } catch (err: any) {
      toast.error(err.message || "فشل الإخلاء");
    } finally {
      setSaving(false);
    }
  };

  const openAuditLog = async () => {
    setShowAuditLog(true);
    const { data } = await supabase
      .from("unit_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setAuditEntries(data ?? []);
  };


  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container-tight py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowRight className="h-3.5 w-3.5" /> العودة للموقع
            </Link>
            <h1 className="mt-2 font-display text-xl font-extrabold sm:text-3xl">لوحة تحكم الوحدات</h1>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">{user?.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openAuditLog}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs hover:border-primary/40 hover:text-primary sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
            >
              <History className="h-4 w-4" /> سجل التدقيق
            </button>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-1.5 text-xs hover:border-destructive/40 hover:text-destructive sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
            >
              <LogOut className="h-4 w-4" /> خروج
            </button>
          </div>
        </div>

        <div className="mb-6">
          <MaintenanceToggle />
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard icon={<Building2 />} label="إجمالي الوحدات" value={stats.total} color="text-primary" />
          <StatCard icon={<CheckCircle2 />} label="متاحة" value={stats.available} color="text-success" />
          <StatCard icon={<Lock />} label="محجوزة" value={stats.reserved} color="text-accent" />
          <StatCard icon={<Users />} label="مؤجرة" value={stats.rented} color="text-destructive" />
          <StatCard icon={<TrendingUp />} label="إيراد سنوي" value={stats.revenue.toLocaleString("en-US")} color="text-accent" small />
        </div>

        <Tabs defaultValue="table" className="mb-6" dir="rtl">
          <TabsList className="mb-4">
            <TabsTrigger value="table">الجدول</TabsTrigger>
            <TabsTrigger value="map">الخريطة التفاعلية</TabsTrigger>
          </TabsList>

          <TabsContent value="map">
            <UnitsMap buildings={buildings} units={units} />
          </TabsContent>

          <TabsContent value="table">
        {/* Building filter */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedBuilding(null)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              !selectedBuilding ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:border-primary/40"
            )}
          >
            كل المباني
          </button>
          {buildings.map((b) => (
            <button
              key={b.number}
              onClick={() => setSelectedBuilding(b.number)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition num",
                selectedBuilding === b.number ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:border-primary/40"
              )}
            >
              مبنى {b.number}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <button
            onClick={() => setStatusFilter("all")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              statusFilter === "all" ? "bg-accent text-accent-foreground" : "border border-border bg-card hover:border-primary/40"
            )}
          >
            كل الحالات
          </button>
          <button
            onClick={() => setStatusFilter("rented")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              statusFilter === "rented" ? "bg-destructive text-destructive-foreground" : "border border-border bg-card hover:border-primary/40"
            )}
          >
            مؤجر
          </button>
          <button
            onClick={() => setStatusFilter("reserved")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              statusFilter === "reserved" ? "bg-accent text-accent-foreground" : "border border-border bg-card hover:border-primary/40"
            )}
          >
            محجوز
          </button>
          <button
            onClick={() => setStatusFilter("available")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition",
              statusFilter === "available" ? "bg-success text-success-foreground" : "border border-border bg-card hover:border-primary/40"
            )}
          >
            متاح
          </button>

          <div className="ms-auto flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground num">
              ({buildingUnits.length} وحدة)
            </span>
            <button
              onClick={() => {
                if (buildingUnits.length === 0) return toast.error("لا توجد بيانات للتصدير");
                exportUnitsToExcel(buildingUnits);
                toast.success("تم تصدير ملف Excel");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-success/40 hover:text-success"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </button>
            <button
              onClick={() => {
                if (buildingUnits.length === 0) return toast.error("لا توجد بيانات للتصدير");
                exportUnitsToCSV(buildingUnits);
                toast.success("تم تصدير ملف CSV");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary/40 hover:text-primary"
            >
              <FileText className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              onClick={() => {
                if (buildingUnits.length === 0) return toast.error("لا توجد بيانات للتصدير");
                exportUnitsToPDF(buildingUnits, {
                  buildingFilter: selectedBuilding,
                  statusFilter,
                  search,
                });
                toast.success("جاري تجهيز PDF...");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-destructive/40 hover:text-destructive"
            >
              <FileDown className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث برقم الوحدة..."
            className="w-full rounded-xl border border-border bg-card py-2.5 pr-10 pl-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>

        {/* Units table */}
        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card" dir="rtl">
            <div className="overflow-x-auto">
              <div className="min-w-[980px]">
                {/* Header */}
                <div
                  className="grid items-center gap-3 bg-secondary px-4 py-3 text-xs font-semibold uppercase text-muted-foreground"
                  style={{ gridTemplateColumns: "70px 80px 90px 110px 120px 110px minmax(180px,1fr) 180px" }}
                >
                  <div className="text-right">المبنى</div>
                  <div className="text-right">الوحدة</div>
                  <div className="text-right">النوع</div>
                  <div className="text-right">المساحة</div>
                  <div className="text-right">السعر</div>
                  <div className="text-right">الحالة</div>
                  <div className="text-right">المستأجر</div>
                  <div className="text-right">إجراء</div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-border">
                  {buildingUnits.map((u) => (
                    <div
                      key={`${u.buildingNumber}-${u.unitNumber}`}
                      className="grid items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary/40"
                      style={{ gridTemplateColumns: "70px 80px 90px 110px 120px 110px minmax(180px,1fr) 180px" }}
                    >
                      <div className="num text-right">{u.buildingNumber}</div>
                      <div className="num text-right font-bold">{u.unitNumber}</div>
                      <div className="text-right text-xs">{u.unitType}</div>
                      <div className="num text-right text-xs">{u.area} م²</div>
                      <div className="num text-right text-xs">{u.price.toLocaleString("en-US")}</div>
                      <div className="text-right">
                        <span className="text-xs font-semibold">{unitStatusLabel(u.leasingStatus)}</span>
                      </div>
                      <div className="truncate text-right text-xs">
                        {u.tenant ? (
                          <span className="font-medium text-foreground">{u.tenant}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                      <div className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setDetailUnit(u)}>تفاصيل الوحدة والعقد</Button>
                      </div>
                    </div>
                  ))}
                  {buildingUnits.length === 0 && (
                    <div className="px-4 py-10 text-center text-muted-foreground">لا توجد نتائج</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
          </TabsContent>
        </Tabs>
      </main>


      <UnitDetailsDialog unit={detailUnit} open={!!detailUnit} onOpenChange={v => { if (!v) setDetailUnit(null); }} />
      {/* Tenant data form dialog */}
      {editingUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm" onClick={() => setEditingUnit(null)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">
                {editingUnit.wasRented ? "تعديل بيانات" : editingUnit.mode === "reserve" ? "حجز" : "تأجير"} الوحدة <span className="num">{editingUnit.unitNumber}</span> — مبنى <span className="num">{editingUnit.building}</span>
              </h3>
              <button onClick={() => setEditingUnit(null)} className="rounded-lg p-1 hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <Field label="اسم المستأجر *" value={tenantForm.tenant_name} onChange={(v) => setTenantForm({ ...tenantForm, tenant_name: v })} />
              <Field label="اسم المركز / المنشأة" value={tenantForm.business_name} onChange={(v) => setTenantForm({ ...tenantForm, business_name: v })} />
              <Field label="نوع النشاط" value={tenantForm.activity_type} onChange={(v) => setTenantForm({ ...tenantForm, activity_type: v })} />
              <Field label="رقم الجوال" value={tenantForm.phone} onChange={(v) => setTenantForm({ ...tenantForm, phone: v })} ltr />
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setEditingUnit(null)}
                className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium hover:bg-secondary"
              >
                إلغاء
              </button>
              <button
                onClick={requestRentConfirmation}
                disabled={saving}
                className="flex-1 rounded-xl bg-gradient-primary py-2.5 text-sm font-bold text-primary-foreground shadow-card hover:shadow-elevated disabled:opacity-50"
              >
                متابعة للتأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm rent / reserve / update */}
      <ConfirmDialog
        open={confirmRent}
        title={
          editingUnit?.wasRented
            ? "تأكيد تحديث بيانات المستأجر"
            : editingUnit?.mode === "reserve"
              ? `تأكيد حجز الوحدة ${editingUnit?.unitNumber ?? ""}`
              : `تأكيد تأجير الوحدة ${editingUnit?.unitNumber ?? ""}`
        }
        description={
          editingUnit?.wasRented
            ? "سيتم حفظ التغييرات على بيانات المستأجر وسيتم تسجيل العملية في سجل التدقيق."
            : editingUnit?.mode === "reserve"
              ? `سيتم تغيير حالة الوحدة إلى "محجوزة" مع حفظ بيانات "${tenantForm.tenant_name}". اكتب سبب الحجز للتوثيق.`
              : `سيتم تغيير حالة الوحدة إلى "مؤجرة" وتسجيل بيانات المستأجر "${tenantForm.tenant_name}". اكتب سبب العملية للتوثيق.`
        }
        confirmLabel="تأكيد وحفظ"
        variant="primary"
        loading={saving}
        reasonPlaceholder="مثال: عقد إيجار جديد رقم 1234 / حجز مبدئي..."
        reasonSuggestions={
          editingUnit?.wasRented
            ? ["تحديث بيانات المستأجر", "تصحيح خطأ إدخال", "تجديد العقد"]
            : editingUnit?.mode === "reserve"
              ? ["حجز مبدئي", "بانتظار توقيع العقد", "بانتظار الدفعة المقدمة"]
              : ["عقد إيجار جديد", "تحويل من حجز إلى تأجير", "نقل من قائمة الانتظار"]
        }
        onConfirm={handleRentConfirmed}
        onCancel={() => setConfirmRent(false)}
      />

      {/* Confirm release */}
      <ConfirmDialog
        open={!!releaseTarget}
        title={`تأكيد إخلاء الوحدة ${releaseTarget?.unitNumber ?? ""}`}
        description={`سيتم تغيير حالة الوحدة إلى "متاحة" وأرشفة بيانات المستأجر الحالي مع السبب (لا تُحذف نهائياً).`}
        confirmLabel="تأكيد الإخلاء"
        variant="destructive"
        loading={saving}
        minReasonLength={5}
        reasonPlaceholder="مثال: انتهاء العقد / فسخ بناءً على طلب المستأجر..."
        reasonSuggestions={["انتهاء العقد", "فسخ من المستأجر", "إخلال بشروط العقد", "تصحيح إدخال خاطئ"]}
        onConfirm={handleReleaseConfirmed}
        onCancel={() => setReleaseTarget(null)}
      />

      {/* Audit log drawer */}
      {showAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm" onClick={() => setShowAuditLog(false)}>
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-card shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                <h3 className="font-display text-lg font-bold">سجل التدقيق — آخر 100 عملية</h3>
              </div>
              <button onClick={() => setShowAuditLog(false)} className="rounded-lg p-1 hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {auditEntries.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">لا توجد عمليات مسجّلة بعد</p>
              ) : (
                <ul className="space-y-3">
                  {auditEntries.map((e) => {
                    const labels: Record<string, { text: string; cls: string }> = {
                      rent: { text: "تأجير", cls: "bg-primary/10 text-primary" },
                      reserve: { text: "حجز", cls: "bg-accent/15 text-accent-foreground" },
                      release: { text: "إخلاء", cls: "bg-success/10 text-success" },
                      update: { text: "تحديث", cls: "bg-secondary text-foreground" },
                    };
                    const lbl = labels[e.action] ?? { text: e.action, cls: "bg-secondary" };
                    return (
                      <li key={e.id} className="rounded-xl border border-border bg-secondary/40 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm">
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", lbl.cls)}>
                              {lbl.text}
                            </span>
                            <span className="font-medium">
                              مبنى <span className="num">{e.building_number}</span> — وحدة <span className="num">{e.unit_number}</span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {e.previous_status} ← {e.new_status}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground num">
                            {new Date(e.created_at).toLocaleString("ar-EG-u-nu-latn")}
                          </div>
                        </div>
                        <p className="mt-2 text-sm">{e.reason}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          بواسطة: {e.performed_by_email ?? "—"}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

const StatCard = ({ icon, label, value, color, small }: any) => (
  <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
    <div className={cn("mb-1.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-secondary", color)}>
      {icon}
    </div>
    <div className="text-[10px] font-medium uppercase text-muted-foreground">{label}</div>
    <div className={cn("font-display font-extrabold num", small ? "text-base" : "text-2xl")}>{value}</div>
  </div>
);

const Field = ({ label, value, onChange, ltr }: { label: string; value: string; onChange: (v: string) => void; ltr?: boolean }) => (
  <div>
    <label className="mb-1 block text-xs font-medium">{label}</label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      dir={ltr ? "ltr" : undefined}
      className={cn("w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none", ltr && "text-right")}
    />
  </div>
);

export default Admin;
