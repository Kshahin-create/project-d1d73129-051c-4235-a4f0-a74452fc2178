import { Button } from "@/components/ui/button";
import { adminClient } from "@/lib/adminData";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

  const [page,setPage]=useState(0),[total,setTotal]=useState(0),[sort,setSort]=useState("created_at");
  const readAccounts=async(offset:number,limit=25)=>{const r=await supabase.rpc("admin_paid_tenants_page",{_search:search,_sort:sort,_limit:limit,_offset:offset});if(r.error)throw r.error;return r.data as unknown as {rows:TenantRow[];count:number};};
  const allRelated=async(table:string,fields:string,ids:string[],active=false)=>{const rows:any[]=[];if(!ids.length)return rows;for(let o=0;;o+=500){let q=adminClient.from(table).select(fields).in("tenant_account_id",ids).order("id").range(o,o+499);if(active)q=q.eq("is_archived",false);const r=await q;if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<500)break;}return rows;};
  const load = async () => {
    setFetching(true);
    try {
      const result=await readAccounts(page*25);setTotal(result.count);const ids=result.rows.map(t=>t.id);
      const [links,collections,files]=await Promise.all([allRelated("tenant_account_units","tenant_account_id, unit_id, units:unit_id(unit_number, building_number, unit_type, area, price, activity)",ids),allRelated("unit_collections","tenant_account_id, unit_id, amount",ids,true),allRelated("tenant_account_files","tenant_account_id, custom_name",ids,true)]);
      const accRes={data:result.rows},linksRes={data:links},collRes={data:collections},filesRes={data:files};
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
  }, [loading, isAdmin, isManager,page,search,sort]);

  const filtered = tenants;
  const fmt = (n: number) => n.toLocaleString("en-US");

  const handleExport = async () => {
    let request:string|undefined;
    try{
    const start=await supabase.rpc("request_admin_export",{_list:"paid_tenants",_format:"xlsx",_scope:{search,sort,basis:"legacy excluding VAT"}});if(start.error)throw start.error;request=String(start.data);
    const all:TenantRow[]=[];for(let o=0;;o+=500){const part=await readAccounts(o,500);all.push(...part.rows);if(part.rows.length<500)break;}

    const rows: Record<string, any>[] = [];
    for (const t of all) {
      const linked=await allRelated("tenant_account_units","unit_id,units:unit_id(unit_number,building_number,price)",[t.id]);
      const units=linked.filter(l=>l.units).map(l=>({...l.units,unit_id:l.unit_id}));
      const collections=await allRelated("unit_collections","unit_id,amount",[t.id],true);
      const paidByTenantUnit=new Map<string,number>();for(const c of collections){const key=`${t.id}:${c.unit_id}`;paidByTenantUnit.set(key,(paidByTenantUnit.get(key)??0)+Number(c.amount));}
      const fileRows=await allRelated("tenant_account_files","custom_name",[t.id],true);const filesByTenant=new Map([[t.id,fileRows.map(f=>f.custom_name)]]);
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
          "تحصيل الوحدة التاريخي بدون الضريبة": "",
          "الملفات": (filesByTenant.get(t.id) ?? []).join("، "),
          "إجمالي التحصيل التاريخي بدون الضريبة": t.collected_total ?? 0,
        });
      } else {
        units.forEach((u, idx) => {
          rows.push({
            "اسم المستأجر أو المنشأة": t.full_name,
            "العلامة التجارية": t.business_name || "",
            "الرقم الوطني الموحد": t.cr_number || "",
            "النشاط": t.activity_type || "",
            "الجوال": t.phone || "",
            "المبنى": u.building_number,
            "الوحدة": u.unit_number,
            "سعر الوحدة": u.price,
            "تحصيل الوحدة التاريخي بدون الضريبة": paidByTenantUnit.get(`${t.id}:${u.unit_id}`) ?? 0,
            "الملفات": (filesByTenant.get(t.id) ?? []).join("، "),
            "إجمالي التحصيل التاريخي بدون الضريبة": idx === 0 ? (t.collected_total ?? 0) : "",
          });
        });
      }
    }
    if (!rows.length) {
      toast.error("لا يوجد بيانات للتصدير");
      return;
    }
    exportRowsToExcel(rows, "paid-tenants", "المسددون");
    const done=await supabase.rpc("complete_admin_export",{_id:request,_status:"generated",_count:rows.length});if(done.error)throw done.error;
    toast.success("تم التصدير");
    }catch(e){if(request)await supabase.rpc("complete_admin_export",{_id:request,_status:"failed",_count:0});toast.error((e as Error).message);}
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
          <div className="flex gap-3"><Button variant="outline" disabled={!page} onClick={()=>setPage(p=>p-1)}>السابق</Button><span>صفحة {page+1}</span><Button variant="outline" disabled={(page+1)*25>=total} onClick={()=>setPage(p=>p+1)}>التالي</Button></div>
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
            <h1 className="font-display text-2xl font-bold">المستأجرون — التحصيل التاريخي</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              تحصيلات تاريخية بدون الضريبة؛ الدفعات الجديدة في الإيصالات والمصادر التاريخية قيد المراجعة
            </p>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary sm:text-sm"
          >
            <Download className="h-4 w-4" /> تصدير
          </button>
        </div>

        <p className="text-xs text-muted-foreground">المرحلة الأولى · {total} مستأجر مطابق · آخر قراءة: {new Date().toLocaleString("ar-SA")}</p>
        <select aria-label="ترتيب المسددين" value={sort} onChange={e=>{setSort(e.target.value);setPage(0);}}><option value="created_at">الأحدث</option><option value="full_name">الاسم</option></select>
        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => {setSearch(e.target.value);setPage(0);}}
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
          <div className="space-y-6">
            {/* Unified exportable table */}
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50 text-xs text-muted-foreground">
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">المستأجر / المنشأة</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">العلامة التجارية</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">الرقم الوطني</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">النشاط</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">الجوال</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">المبنى</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">الوحدة</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">النوع</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">المساحة</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">سعر الوحدة</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">تحصيل الوحدة التاريخي بدون الضريبة</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">الملفات</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">إجمالي التحصيل التاريخي بدون الضريبة</th>
                    <th className="px-3 py-3 text-right font-medium whitespace-nowrap">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.flatMap((t) => {
                    const units = unitsByTenant.get(t.id) ?? [];
                    const files = filesByTenant.get(t.id) ?? [];
                    const filesText = files.join("، ");
                    const isFullyPaid = Number(t.paid_amount) >= Number(t.total_price) && Number(t.total_price) > 0;
                    if (units.length === 0) {
                      return [
                        <tr key={t.id} className="border-b border-border/50 last:border-0">
                          <td className="px-3 py-3 font-medium">{t.full_name}</td>
                          <td className="px-3 py-3">{t.business_name || "—"}</td>
                          <td className="px-3 py-3">{t.cr_number || "—"}</td>
                          <td className="px-3 py-3">{t.activity_type || "—"}</td>
                          <td className="px-3 py-3" dir="ltr">{t.phone || "—"}</td>
                          <td className="px-3 py-3">—</td>
                          <td className="px-3 py-3">—</td>
                          <td className="px-3 py-3">—</td>
                          <td className="px-3 py-3">—</td>
                          <td className="px-3 py-3">—</td>
                          <td className="px-3 py-3">—</td>
                          <td className="px-3 py-3 max-w-xs truncate">{filesText || "—"}</td>
                          <td className="px-3 py-3 font-medium">{fmt(Number(t.collected_total || 0))} ر.س</td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isFullyPaid ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}>
                              {isFullyPaid ? "مسدد بالكامل" : "مسدد جزئياً"}
                            </span>
                          </td>
                        </tr>,
                      ];
                    }
                    return units.map((u, idx) => (
                      <tr key={`${t.id}-${u.unit_id}`} className="border-b border-border/50 last:border-0">
                        <td className="px-3 py-3 font-medium">{t.full_name}</td>
                        <td className="px-3 py-3">{t.business_name || "—"}</td>
                        <td className="px-3 py-3">{t.cr_number || "—"}</td>
                        <td className="px-3 py-3">{t.activity_type || "—"}</td>
                        <td className="px-3 py-3" dir="ltr">{t.phone || "—"}</td>
                        <td className="px-3 py-3">{u.building_number}</td>
                        <td className="px-3 py-3"><Link className="text-primary hover:underline" to={`/admin/units/${u.unit_id}`}>{u.unit_number}</Link></td>
                        <td className="px-3 py-3">{u.unit_type || "—"}</td>
                        <td className="px-3 py-3">{fmt(u.area)} م²</td>
                        <td className="px-3 py-3">{fmt(u.price)} ر.س</td>
                        <td className="px-3 py-3 font-medium text-green-600">
                          {fmt(paidByTenantUnit.get(`${t.id}:${u.unit_id}`) ?? 0)} ر.س
                        </td>
                        <td className="px-3 py-3 max-w-xs truncate">{idx === 0 ? filesText || "—" : "—"}</td>
                        <td className="px-3 py-3 font-medium">{idx === 0 ? `${fmt(Number(t.collected_total || 0))} ر.س` : "—"}</td>
                        <td className="px-3 py-3">
                          {idx === 0 ? (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isFullyPaid ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}>
                              {isFullyPaid ? "مسدد بالكامل" : "مسدد جزئياً"}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards view */}
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
                        <div className="text-xs text-muted-foreground">إجمالي التحصيل التاريخي بدون الضريبة</div>
                        <div className="font-display text-lg font-bold text-primary">
                          {fmt(Number(t.collected_total || 0))} ر.س
                        </div>
                        <div className="text-xs text-muted-foreground">
                          من أصل {fmt(Number(t.total_price || 0))} ر.س
                        </div>
                      </div>
                    </div>

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
          </div>
        )}
        <div className="flex gap-3"><Button variant="outline" disabled={!page} onClick={()=>setPage(p=>p-1)}>السابق</Button><span>صفحة {page+1}</span><Button variant="outline" disabled={(page+1)*25>=total} onClick={()=>setPage(p=>p+1)}>التالي</Button></div>
      </main>
    </div>
  );
}
