import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, LogOut, Building2, Lock, CheckCircle2, Search, Users, TrendingUp, X, History } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { useBuildingsAndUnits } from "@/hooks/useBuildings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [search, setSearch] = useState("");
  const [editingUnit, setEditingUnit] = useState<{ id: string; unitNumber: number; building: number; wasRented: boolean } | null>(null);
  const [tenantForm, setTenantForm] = useState<TenantForm>({ tenant_name: "", business_name: "", activity_type: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [confirmRent, setConfirmRent] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<{ unitNumber: number; buildingNumber: number } | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);

  // Auth gate
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

  const buildings = data?.buildings ?? [];
  const units = data?.units ?? [];

  const buildingUnits = useMemo(() => {
    let list = selectedBuilding ? units.filter((u) => u.buildingNumber === selectedBuilding) : units;
    if (search.trim()) {
      const q = search.trim();
      list = list.filter((u) => String(u.unitNumber).includes(q));
    }
    return list;
  }, [selectedBuilding, units, search]);

  const stats = useMemo(() => {
    const total = units.length;
    const rented = units.filter((u) => u.status === "rented").length;
    const revenue = units.filter((u) => u.status === "rented").reduce((s, u) => s + u.price, 0);
    return { total, rented, available: total - rented, revenue };
  }, [units]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const writeAuditLog = async (entry: {
    unit_id: string;
    building_number: number;
    unit_number: number;
    action: "rent" | "release" | "update";
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

  const openRentDialog = async (unitNumber: number, buildingNumber: number, currentStatus: string) => {
    const { data: u } = await supabase
      .from("units")
      .select("id")
      .eq("building_number", buildingNumber)
      .eq("unit_number", unitNumber)
      .maybeSingle();
    if (!u) return;
    setEditingUnit({ id: u.id, unitNumber, building: buildingNumber, wasRented: currentStatus === "rented" });
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
      const action = editingUnit.wasRented ? "update" : "rent";
      const previousStatus = editingUnit.wasRented ? "rented" : "available";

      const { error: ue } = await supabase.from("units").update({ status: "rented" }).eq("id", editingUnit.id);
      if (ue) throw ue;

      const { data: existing } = await supabase.from("tenants").select("id").eq("unit_id", editingUnit.id).maybeSingle();
      if (existing) {
        const { error } = await supabase.from("tenants").update(tenantForm).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tenants").insert({ ...tenantForm, unit_id: editingUnit.id });
        if (error) throw error;
      }

      await writeAuditLog({
        unit_id: editingUnit.id,
        building_number: editingUnit.building,
        unit_number: editingUnit.unitNumber,
        action,
        previous_status: previousStatus,
        new_status: "rented",
        reason,
        tenant_snapshot: tenantForm,
      });

      toast.success(`تم ${editingUnit.wasRented ? "تحديث بيانات" : "تأجير"} الوحدة ${editingUnit.unitNumber}`);
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
        .from("units").select("id")
        .eq("building_number", releaseTarget.buildingNumber)
        .eq("unit_number", releaseTarget.unitNumber)
        .maybeSingle();
      if (!u) throw new Error("الوحدة غير موجودة");

      const { data: tenantSnap } = await supabase.from("tenants").select("*").eq("unit_id", u.id).maybeSingle();

      await supabase.from("tenants").delete().eq("unit_id", u.id);
      const { error } = await supabase.from("units").update({ status: "available" }).eq("id", u.id);
      if (error) throw error;

      await writeAuditLog({
        unit_id: u.id,
        building_number: releaseTarget.buildingNumber,
        unit_number: releaseTarget.unitNumber,
        action: "release",
        previous_status: "rented",
        new_status: "available",
        reason,
        tenant_snapshot: tenantSnap,
      });

      toast.success(`تم إخلاء الوحدة ${releaseTarget.unitNumber}`);
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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowRight className="h-3.5 w-3.5" /> العودة للموقع
            </Link>
            <h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">لوحة تحكم الوحدات</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm hover:border-destructive/40 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" /> خروج
          </button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<Building2 />} label="إجمالي الوحدات" value={stats.total} color="text-primary" />
          <StatCard icon={<CheckCircle2 />} label="متاحة" value={stats.available} color="text-success" />
          <StatCard icon={<Users />} label="مؤجرة" value={stats.rented} color="text-destructive" />
          <StatCard icon={<TrendingUp />} label="إيراد سنوي" value={stats.revenue.toLocaleString("ar-EG")} color="text-accent" small />
        </div>

        {/* Building filter */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
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
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-right">المبنى</th>
                    <th className="px-4 py-3 text-right">الوحدة</th>
                    <th className="px-4 py-3 text-right">النوع</th>
                    <th className="px-4 py-3 text-right">المساحة</th>
                    <th className="px-4 py-3 text-right">السعر</th>
                    <th className="px-4 py-3 text-right">الحالة</th>
                    <th className="px-4 py-3 text-right">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {buildingUnits.map((u) => (
                    <tr key={`${u.buildingNumber}-${u.unitNumber}`} className="hover:bg-secondary/40">
                      <td className="px-4 py-2.5 num">{u.buildingNumber}</td>
                      <td className="px-4 py-2.5 num font-bold">{u.unitNumber}</td>
                      <td className="px-4 py-2.5 text-xs">{u.unitType}</td>
                      <td className="px-4 py-2.5 num text-xs">{u.area} م²</td>
                      <td className="px-4 py-2.5 num text-xs">{u.price.toLocaleString("ar-EG")}</td>
                      <td className="px-4 py-2.5">
                        {u.status === "rented" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                            <Lock className="h-2.5 w-2.5" /> مؤجر
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                            <CheckCircle2 className="h-2.5 w-2.5" /> متاح
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {u.status === "rented" ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => openRentDialog(u.unitNumber, u.buildingNumber, u.status)}
                              className="rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-medium hover:bg-primary/10"
                            >
                              عرض/تعديل
                            </button>
                            <button
                              onClick={() => setReleaseTarget({ unitNumber: u.unitNumber, buildingNumber: u.buildingNumber })}
                              className="rounded-lg bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success hover:bg-success/20"
                            >
                              إخلاء
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openRentDialog(u.unitNumber, u.buildingNumber, u.status)}
                            className="rounded-lg bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
                          >
                            تأجير
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {buildingUnits.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">لا توجد نتائج</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Tenant data form dialog */}
      {editingUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm" onClick={() => setEditingUnit(null)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">
                {editingUnit.wasRented ? "تعديل بيانات" : "تأجير"} الوحدة <span className="num">{editingUnit.unitNumber}</span> — مبنى <span className="num">{editingUnit.building}</span>
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

      {/* Confirm rent / update */}
      <ConfirmDialog
        open={confirmRent}
        title={editingUnit?.wasRented ? "تأكيد تحديث بيانات المستأجر" : `تأكيد تأجير الوحدة ${editingUnit?.unitNumber ?? ""}`}
        description={
          editingUnit?.wasRented
            ? "سيتم حفظ التغييرات على بيانات المستأجر وسيتم تسجيل العملية في سجل التدقيق."
            : `سيتم تغيير حالة الوحدة إلى "مؤجرة" وتسجيل بيانات المستأجر "${tenantForm.tenant_name}". اكتب سبب العملية للتوثيق.`
        }
        confirmLabel="تأكيد وحفظ"
        variant="primary"
        loading={saving}
        reasonPlaceholder="مثال: عقد إيجار جديد رقم 1234 / تجديد عقد..."
        reasonSuggestions={
          editingUnit?.wasRented
            ? ["تحديث بيانات المستأجر", "تصحيح خطأ إدخال", "تجديد العقد"]
            : ["عقد إيجار جديد", "حجز موثّق", "نقل من قائمة الانتظار"]
        }
        onConfirm={handleRentConfirmed}
        onCancel={() => setConfirmRent(false)}
      />

      {/* Confirm release */}
      <ConfirmDialog
        open={!!releaseTarget}
        title={`تأكيد إخلاء الوحدة ${releaseTarget?.unitNumber ?? ""}`}
        description={`سيتم تغيير حالة الوحدة إلى "متاحة" وحذف بيانات المستأجر الحالي. سيُحفظ نسخة من بياناته في سجل التدقيق.`}
        confirmLabel="تأكيد الإخلاء"
        variant="destructive"
        loading={saving}
        reasonPlaceholder="مثال: انتهاء العقد / فسخ بناءً على طلب المستأجر..."
        reasonSuggestions={["انتهاء العقد", "فسخ من المستأجر", "إخلال بشروط العقد", "تصحيح إدخال خاطئ"]}
        onConfirm={handleReleaseConfirmed}
        onCancel={() => setReleaseTarget(null)}
      />

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
