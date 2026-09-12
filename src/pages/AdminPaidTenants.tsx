import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Search,
  Download,
  Lock,
  Wallet,
  Building2,
  FolderOpen,
  BadgeCheck,
} from "lucide-react";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportRowsToExcel } from "@/lib/exportData";

type TenantRow = {
  id: string;
  full_name: string;
  business_name: string | null;
  cr_number: string | null;
  activity_type: string | null;
  phone: string | null;
  email: string | null;
  total_price: number;
  paid_amount: number;
  collected_total: number;
  units_count: number;
  files_count: number;
  created_at: string;
};

type UnitInfo = {
  unit_id: string;
  unit_number: number;
  building_number: number;
  unit_type: string | null;
  area: number;
  price: number;
  activity: string | null;
};

export default function AdminPaidTenants() {
  const nav = useNavigate();
  const { user, isAdmin, isManager, loading } = useAuth();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [unitsByTenant, setUnitsByTenant] = useState<Map<string, UnitInfo[]>>(new Map());
  const [paidByTenantUnit, setPaidByTenantUnit] = useState<Map<string, number>>(new Map());
  const [filesByTenant, setFilesByTenant] = useState<Map<string, string[]>>(new Map());
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setFetching(true);
    try {
      const [accRes, linksRes, collRes, filesRes] = await Promise.all([
        supabase.rpc("admin_list_tenant_accounts"),
        supabase
          .from("tenant_account_units")
          .select(
            "tenant_account_id, unit_id, units:unit_id(unit_number, building_number, unit_type, area, price, activity)",
          )
          .limit(5000),
        supabase
          .from("unit_collections")
          .select("tenant_account_id, unit_id, amount, is_archived")
          .eq("is_archived", false)
          .limit(10000),
        supabase
          .from("tenant_account_files")
          .select("tenant_account_id, custom_name, is_archived")
          .eq("is_archived", false)
          .limit(10000),
      ]);
      if (accRes.error) throw accRes.error;

      const uMap = new Map<string, UnitInfo[]>();
      for (const l of (linksRes.data as any[]) ?? []) {
        if (!l.units) continue;
        const arr = uMap.get(l.tenant_account_id) ?? [];
        arr.push({
          unit_id: l.unit_id,
          unit_number: l.units.unit_number,
          building_number: l.units.building_number,
          unit_type: l.units.unit_type,
          area: Number(l.units.area),
          price: Number(l.units.price),
          activity: l.units.activity,
        });
        uMap.set(l.tenant_account_id, arr);
      }
      for (const arr of uMap.values()) {
        arr.sort((a, b) => a.building_number - b.building_number || a.unit_number - b.unit_number);
      }
      setUnitsByTenant(uMap);

      const cMap = new Map<string, number>();
      for (const c of (collRes.data as any[]) ?? []) {
        const key = `${c.tenant_account_id}:${c.unit_id}`;
        cMap.set(key, (cMap.get(key) ?? 0) + Number(c.amount));
      }
      setPaidByTenantUnit(cMap);

      const fMap = new Map<string, string[]>();
      for (const f of (filesRes.data as any[]) ?? []) {
        const arr = fMap.get(f.tenant_account_id) ?? [];
        arr.push(f.custom_name);
        fMap.set(f.tenant_account_id, arr);
      }
      setFilesByTenant(fMap);

      const all = (accRes.data as TenantRow[]) ?? [];
      setTenants(
        all.filter((t) => Number(t.paid_amount) > 0),
      );
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر تحميل البيانات");
    }
    setFetching(false);
  };

  useEffect(() => {
    if (!loading && (isAdmin || isManager)) load();
  }, [loading, isAdmin, isManager]);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.full_name?.includes(q) ||
        t.business_name?.includes(q) ||
        t.activity_type?.includes(q) ||
        t.phone?.includes(q) ||
        t.cr_number?.includes(q),
    );
  }, [tenants, search]);

  const stats = useMemo(() => {
    const totalCollected = filtered.reduce((s, t) => s + Number(t.collected_total || 0), 0);
    const totalContracts = filtered.reduce((s, t) => s + Number(t.total_price || 0), 0);
    const totalUnits = filtered.reduce((s, t) => s + Number(t.units_count || 0), 0);
    return { count: filtered.length, totalCollected, totalContracts, totalUnits };
  }, [filtered]);

  const fmt = (n: number) => n.toLocaleString("en-US");

  const handleExport = () => {
    const rows: Record<string, any>[] = [];
    for (const t of filtered) {
      const units = unitsByTenant.get(t.id) ?? [];
      if (units.length === 0) {
        rows.push({
          "اسم المستأجر أو المنشأة": t.full_name,
          "العلامة التجارية": t.business_name || "",
          "الرقم الوطني الموحد": t.cr_number || "",
          "النشاط": t.activity_type || "",
          "الجوال": t.phone || "",
          "المبنى": "",
          "الوحدة": "",
          "سعر الوحدة": "",
          "المسدد على الوحدة": "",
          "الملفات": (filesByTenant.get(t.id) ?? []).join("، "),
          "إجمالي المحصل": t.collected_total ?? 0,
        });
      } else {
        for (const u of units) {
          rows.push({
            "اسم المستأجر أو المنشأة": t.full_name,
            "العلامة التجارية": t.business_name || "",
            "الرقم الوطني الموحد": t.cr_number || "",
            "النشاط": t.activity_type || "",
            "الجوال": t.phone || "",
            "المبنى": u.building_number,
            "الوحدة": u.unit_number,
            "سعر الوحدة": u.price,
            "المسدد على الوحدة": paidByTenantUnit.get(`${t.id}:${u.unit_id}`) ?? 0,
            "الملفات": (filesByTenant.get(t.id) ?? []).join("، "),
            "إجمالي المحصل": t.collected_total ?? 0,
          });
        }
      }
    }
    if (!rows.length) {
      toast.error("لا يوجد بيانات للتصدير");
      return;
    }
    exportRowsToExcel(rows, "paid-tenants", "المسددون");
    toast.success("تم التصدير");
  };

  if (!loading && !user) {
    nav("/auth");
    return null;
  }
  if (!loading && !isAdmin && !isManager) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <Header />
        <main className="container-tight py-16">
          <div className="mx-auto max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
            <Lock className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-4 font-display text-xl font-bold">لا تملك صلاحية الوصول</h2>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <main className="container-tight space-y-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">المستأجرون المسددون</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              كل المستأجرين الذين سددوا أي دفعات — مع تفاصيل الوحدات والتحصيلات والملفات
            </p>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary sm:text-sm"
          >
            <Download className="h-4 w-4" /> تصدير
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "عدد المسددين", value: fmt(stats.count), Icon: BadgeCheck },
            { label: "إجمالي العقود", value: `${fmt(stats.totalContracts)} ر.س`, Icon: Building2 },
            { label: "إجمالي المحصل", value: `${fmt(stats.totalCollected)} ر.س`, Icon: Wallet },
            { label: "إجمالي الوحدات", value: fmt(stats.totalUnits), Icon: FolderOpen },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <k.Icon className="h-4 w-4 text-primary" />
                {k.label}
              </div>
              <div className="mt-2 font-display text-xl font-bold">{k.value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم، العلامة التجارية، النشاط، الجوال..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>

        {fetching ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
            لا يوجد مستأجرون مسددون حالياً
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((t) => {
              const units = unitsByTenant.get(t.id) ?? [];
              const files = filesByTenant.get(t.id) ?? [];
              return (
                <div key={t.id} className="rounded-2xl border border-border bg-card p-5">
                  {/* Tenant header */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-display text-lg font-bold">{t.full_name}</h2>
                        {Number(t.paid_amount) >= Number(t.total_price) && Number(t.total_price) > 0 ? (
                          <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                            مسدد بالكامل
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
                            مسدد جزئياً
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {t.business_name && <span>العلامة التجارية: {t.business_name}</span>}
                        {t.activity_type && <span>النشاط: {t.activity_type}</span>}
                        {t.cr_number && <span>الرقم الوطني: {t.cr_number}</span>}
                        {t.phone && <span dir="ltr">{t.phone}</span>}
                        {t.email && <span dir="ltr">{t.email}</span>}
                      </div>
                    </div>
                    <div className="text-left text-sm">
                      <div className="text-xs text-muted-foreground">إجمالي المحصل</div>
                      <div className="font-display text-lg font-bold text-primary">
                        {fmt(Number(t.collected_total || 0))} ر.س
                      </div>
                      <div className="text-xs text-muted-foreground">
                        من أصل {fmt(Number(t.total_price || 0))} ر.س
                      </div>
                    </div>
                  </div>

                  {/* Units table */}
                  {units.length > 0 && (
                    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-secondary/50 text-xs text-muted-foreground">
                            <th className="px-3 py-2 text-right font-medium">المبنى</th>
                            <th className="px-3 py-2 text-right font-medium">الوحدة</th>
                            <th className="px-3 py-2 text-right font-medium">النوع</th>
                            <th className="px-3 py-2 text-right font-medium">المساحة</th>
                            <th className="px-3 py-2 text-right font-medium">النشاط</th>
                            <th className="px-3 py-2 text-right font-medium">سعر الوحدة</th>
                            <th className="px-3 py-2 text-right font-medium">المسدد على الوحدة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {units.map((u) => (
                            <tr key={u.unit_id} className="border-b border-border/50 last:border-0">
                              <td className="px-3 py-2">{u.building_number}</td>
                              <td className="px-3 py-2">{u.unit_number}</td>
                              <td className="px-3 py-2">{u.unit_type || "—"}</td>
                              <td className="px-3 py-2">{fmt(u.area)} م²</td>
                              <td className="px-3 py-2">{u.activity || "—"}</td>
                              <td className="px-3 py-2">{fmt(u.price)} ر.س</td>
                              <td className="px-3 py-2 font-medium text-green-600">
                                {fmt(paidByTenantUnit.get(`${t.id}:${u.unit_id}`) ?? 0)} ر.س
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Files */}
                  {files.length > 0 && (
                    <div className="mt-4">
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <FolderOpen className="h-3.5 w-3.5" />
                        الملفات ({files.length})
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {files.map((name, i) => (
                          <span
                            key={i}
                            className="rounded-lg bg-secondary px-2 py-1 text-xs"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
