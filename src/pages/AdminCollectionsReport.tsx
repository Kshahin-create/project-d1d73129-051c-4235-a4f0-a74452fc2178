import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Search,
  Download,
  Lock,
  Wallet,
  Building2,
  Banknote,
  Percent,
} from "lucide-react";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportRowsToExcel } from "@/lib/exportData";

type UnitRow = {
  id: string;
  building_number: number;
  unit_number: number;
  unit_type: string | null;
  area: number;
  price: number;
  status: string;
  tenant_name: string | null;
  tenant_phone: string | null;
  tenant_business: string | null;
  collected: number;
  payments_count: number;
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export default function AdminCollectionsReport() {
  const nav = useNavigate();
  const { user, isAdmin, isManager, loading } = useAuth();
  const [rows, setRows] = useState<UnitRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [buildingFilter, setBuildingFilter] = useState<string>("all");

  const load = async () => {
    setFetching(true);
    try {
      const [unitsRes, tenantsRes, collRes, linksRes, accRes] = await Promise.all([
        supabase
          .from("units")
          .select("id, building_number, unit_number, unit_type, area, price, status")
          .in("status", ["rented", "booked"])
          .limit(5000),
        supabase
          .from("tenants")
          .select("unit_id, tenant_name, business_name, phone")
          .limit(5000),
        supabase
          .from("unit_collections")
          .select("unit_id, amount, is_archived")
          .eq("is_archived", false)
          .limit(20000),
        supabase
          .from("tenant_account_units")
          .select("unit_id, tenant_account_id")
          .limit(5000),
        supabase.rpc("admin_list_tenant_accounts"),
      ]);
      if (unitsRes.error) throw unitsRes.error;

      const tenantByUnit = new Map<string, any>();
      for (const t of (tenantsRes.data as any[]) ?? []) {
        tenantByUnit.set(t.unit_id, t);
      }
      const accById = new Map<string, any>();
      for (const a of (accRes.data as any[]) ?? []) accById.set(a.id, a);
      const accByUnit = new Map<string, any>();
      for (const l of (linksRes.data as any[]) ?? []) {
        const acc = accById.get(l.tenant_account_id);
        if (acc) accByUnit.set(l.unit_id, acc);
      }

      const collByUnit = new Map<string, { total: number; count: number }>();
      for (const c of (collRes.data as any[]) ?? []) {
        const cur = collByUnit.get(c.unit_id) ?? { total: 0, count: 0 };
        cur.total += Number(c.amount);
        cur.count += 1;
        collByUnit.set(c.unit_id, cur);
      }

      const list: UnitRow[] = ((unitsRes.data as any[]) ?? []).map((u) => {
        const t = tenantByUnit.get(u.id);
        const acc = accByUnit.get(u.id);
        const coll = collByUnit.get(u.id) ?? { total: 0, count: 0 };
        return {
          id: u.id,
          building_number: u.building_number,
          unit_number: u.unit_number,
          unit_type: u.unit_type,
          area: Number(u.area),
          price: Number(u.price),
          status: u.status,
          tenant_name: t?.tenant_name ?? acc?.full_name ?? null,
          tenant_phone: t?.phone ?? acc?.phone ?? null,
          tenant_business: t?.business_name ?? acc?.business_name ?? null,
          collected: coll.total,
          payments_count: coll.count,
        };
      });
      list.sort(
        (a, b) =>
          a.building_number - b.building_number || a.unit_number - b.unit_number,
      );
      setRows(list);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر تحميل البيانات");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!loading && (isAdmin || isManager)) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAdmin, isManager]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return rows.filter((r) => {
      if (buildingFilter !== "all" && String(r.building_number) !== buildingFilter)
        return false;
      if (!q) return true;
      const hay = [
        r.tenant_name,
        r.tenant_business,
        r.tenant_phone,
        String(r.building_number),
        String(r.unit_number),
      ]
        .filter(Boolean)
        .join(" ");
      return hay.includes(q);
    });
  }, [rows, search, buildingFilter]);

  const totals = useMemo(() => {
    const collected = filtered.reduce((s, r) => s + r.collected, 0);
    const prices = filtered.reduce((s, r) => s + r.price, 0);
    const payments = filtered.reduce((s, r) => s + r.payments_count, 0);
    const withCollection = filtered.filter((r) => r.collected > 0).length;
    return {
      collected,
      prices,
      payments,
      withCollection,
      units: filtered.length,
      pct: prices > 0 ? (collected / prices) * 100 : 0,
    };
  }, [filtered]);

  const perBuilding = useMemo(() => {
    const m = new Map<number, { collected: number; price: number; units: number }>();
    for (const r of filtered) {
      const cur = m.get(r.building_number) ?? { collected: 0, price: 0, units: 0 };
      cur.collected += r.collected;
      cur.price += r.price;
      cur.units += 1;
      m.set(r.building_number, cur);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  const buildings = useMemo(
    () => [...new Set(rows.map((r) => r.building_number))].sort((a, b) => a - b),
    [rows],
  );

  const doExport = () => {
    const data = filtered.map((r) => ({
      "المبنى": r.building_number,
      "الوحدة": r.unit_number,
      "النوع": r.unit_type ?? "",
      "المساحة (م²)": r.area,
      "الحالة": r.status === "rented" ? "مؤجرة" : "محجوزة",
      "المستأجر": r.tenant_name ?? "",
      "المنشأة": r.tenant_business ?? "",
      "الجوال": r.tenant_phone ?? "",
      "سعر الوحدة": r.price,
      "المحصّل": r.collected,
      "عدد الدفعات": r.payments_count,
      "المتبقي": Math.max(0, r.price - r.collected),
    }));
    exportRowsToExcel(data, `تقرير-تحصيلات-الوحدات-${new Date().toISOString().slice(0, 10)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user || (!isAdmin && !isManager)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">هذه الصفحة متاحة للإدارة فقط</p>
        <button onClick={() => nav("/")} className="text-primary underline">
          العودة للرئيسية
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">تقرير تحصيلات الوحدات الشغالة</h1>
            <p className="text-sm text-muted-foreground">
              كل الوحدات المؤجرة والمحجوزة مع المبالغ المحصّلة على كل وحدة
            </p>
          </div>
          <button
            onClick={doExport}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            تصدير Excel
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Banknote className="h-4 w-4 text-primary" />
              إجمالي المحصّل
            </div>
            <div className="mt-2 text-2xl font-bold text-primary">
              {fmt(totals.collected)} ريال
            </div>
            <div className="text-xs text-muted-foreground">
              <span lang="en">{fmt(totals.payments)}</span> دفعة مسجلة
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              الوحدات الشغالة
            </div>
            <div className="mt-2 text-2xl font-bold" lang="en">{fmt(totals.units)}</div>
            <div className="text-xs text-muted-foreground">
              <span lang="en">{fmt(totals.withCollection)}</span> عليها تحصيل
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4" />
              إجمالي قيمة العقود
            </div>
            <div className="mt-2 text-2xl font-bold">{fmt(totals.prices)} ريال</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Percent className="h-4 w-4" />
              نسبة التحصيل
            </div>
            <div className="mt-2 text-2xl font-bold">{fmt(totals.pct)}%</div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, totals.pct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Per building */}
        <div className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3 font-semibold">التحصيل حسب المبنى</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-4 py-2 text-right">المبنى</th>
                  <th className="px-4 py-2 text-right">الوحدات</th>
                  <th className="px-4 py-2 text-right">المحصّل</th>
                  <th className="px-4 py-2 text-right">قيمة العقود</th>
                  <th className="px-4 py-2 text-right">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {perBuilding.map(([b, v]) => (
                  <tr key={b} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">مبنى <span lang="en">{fmt(b)}</span></td>
                    <td className="px-4 py-2" lang="en">{fmt(v.units)}</td>
                    <td className="px-4 py-2 font-semibold text-primary">
                      {fmt(v.collected)} ريال
                    </td>
                    <td className="px-4 py-2">{fmt(v.price)} ريال</td>
                    <td className="px-4 py-2" lang="en">
                      {v.price > 0 ? fmt((v.collected / v.price) * 100) : fmt(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو المنشأة أو رقم الوحدة..."
              className="w-full rounded-lg border bg-card py-2 pr-9 pl-3 text-sm"
            />
          </div>
          <select
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
            className="rounded-lg border bg-card px-3 py-2 text-sm"
          >
            <option value="all">كل المباني</option>
            {buildings.map((b) => (
              <option key={b} value={String(b)}>
                مبنى <span lang="en">{fmt(b)}</span>
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        {fetching ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-muted-foreground">
                  <th className="px-3 py-2 text-right">المبنى</th>
                  <th className="px-3 py-2 text-right">الوحدة</th>
                  <th className="px-3 py-2 text-right">الحالة</th>
                  <th className="px-3 py-2 text-right">المستأجر</th>
                  <th className="px-3 py-2 text-right">المنشأة</th>
                  <th className="px-3 py-2 text-right">سعر الوحدة</th>
                  <th className="px-3 py-2 text-right">المحصّل</th>
                  <th className="px-3 py-2 text-right">الدفعات</th>
                  <th className="px-3 py-2 text-right">المتبقي</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2" lang="en">{fmt(r.building_number)}</td>
                    <td className="px-3 py-2 font-medium" lang="en">{fmt(r.unit_number)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.status === "rented"
                            ? "bg-green-500/10 text-green-600"
                            : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {r.status === "rented" ? "مؤجرة" : "محجوزة"}
                      </span>
                    </td>
                    <td className="px-3 py-2">{r.tenant_name ?? "—"}</td>
                    <td className="px-3 py-2">{r.tenant_business ?? "—"}</td>
                    <td className="px-3 py-2" lang="en">{fmt(r.price)}</td>
                    <td className="px-3 py-2 font-semibold text-primary" lang="en">
                      {fmt(r.collected)}
                    </td>
                    <td className="px-3 py-2" lang="en">{fmt(r.payments_count)}</td>
                    <td className="px-3 py-2" lang="en">{fmt(Math.max(0, r.price - r.collected))}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      لا توجد نتائج مطابقة
                    </td>
                  </tr>
                )}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/50 font-semibold">
                    <td className="px-3 py-2" colSpan={5}>
                      الإجمالي (<span lang="en">{fmt(filtered.length)}</span> وحدة)
                    </td>
                    <td className="px-3 py-2" lang="en">{fmt(totals.prices)}</td>
                    <td className="px-3 py-2 text-primary" lang="en">{fmt(totals.collected)}</td>
                    <td className="px-3 py-2" lang="en">{fmt(totals.payments)}</td>
                    <td className="px-3 py-2" lang="en">{fmt(Math.max(0, totals.prices - totals.collected))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
