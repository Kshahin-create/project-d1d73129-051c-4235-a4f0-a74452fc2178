import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { History, Lock, Search, ArrowRight, Filter, ChevronDown, ChevronLeft } from "lucide-react";

interface AuditRow {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: "INSERT" | "UPDATE" | "DELETE" | string;
  entity_table: string;
  entity_id: string | null;
  before_data: any;
  after_data: any;
  changed_fields: string[] | null;
  ip_address: string | null;
  user_agent: string | null;
}

const ACTION_AR: Record<string, { label: string; cls: string }> = {
  INSERT: { label: "إضافة", cls: "bg-emerald-500/10 text-emerald-600" },
  UPDATE: { label: "تعديل", cls: "bg-amber-500/10 text-amber-600" },
  DELETE: { label: "حذف", cls: "bg-destructive/10 text-destructive" },
};

const TABLE_AR: Record<string, string> = {
  units: "الوحدات",
  buildings: "المباني",
  tenants: "المستأجرون",
  bookings: "الحجوزات",
  booking_units: "وحدات الحجز",
  user_roles: "أدوار المستخدمين",
  profiles: "الملفات الشخصية",
  api_keys: "مفاتيح الـ API",
  customer_profiles: "ملفات العملاء",
};

const formatVal = (v: any): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "boolean") return v ? "نعم" : "لا";
  return String(v);
};

const AdminAudit = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("audit_log" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) toast.error("تعذر التحميل: " + error.message);
    else setRows((data as any as AuditRow[]) ?? []);
    setFetching(false);
  };

  useEffect(() => {
    if (!loading && isAdmin) load();
  }, [loading, isAdmin]);

  const tables = useMemo(() => {
    const s = new Set(rows.map((r) => r.entity_table));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (tableFilter !== "all" && r.entity_table !== tableFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const haystack = [
        r.actor_email,
        r.entity_table,
        r.entity_id,
        JSON.stringify(r.before_data ?? {}),
        JSON.stringify(r.after_data ?? {}),
        (r.changed_fields ?? []).join(","),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, actionFilter, tableFilter]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!loading && !user) {
    navigate("/auth");
    return null;
  }
  if (!loading && user && !isAdmin) {
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
              <History className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold sm:text-2xl">سجل التدقيق الكامل</h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                {filtered.length} عملية من إجمالي {rows.length}
              </p>
            </div>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary sm:px-4 sm:py-2 sm:text-sm"
          >
            <ArrowRight className="h-4 w-4" /> رجوع
          </Link>
        </div>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card p-2">
            <Search className="mr-2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في كل الحقول..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-transparent text-sm outline-none"
            >
              <option value="all">كل العمليات</option>
              <option value="INSERT">إضافة</option>
              <option value="UPDATE">تعديل</option>
              <option value="DELETE">حذف</option>
            </select>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
            <select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="bg-transparent text-sm outline-none"
            >
              <option value="all">كل الجداول</option>
              {tables.map((t) => (
                <option key={t} value={t}>{TABLE_AR[t] ?? t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card">
          {fetching ? (
            <div className="p-12 text-center text-muted-foreground">جارِ التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا توجد سجلات</div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((r) => {
                const act = ACTION_AR[r.action] ?? { label: r.action, cls: "bg-secondary text-foreground" };
                const isOpen = expanded.has(r.id);
                const changed = r.changed_fields ?? [];
                return (
                  <li key={r.id} className="p-3">
                    <button
                      onClick={() => toggle(r.id)}
                      className="flex w-full items-start gap-3 text-right"
                    >
                      <div className="mt-0.5 shrink-0 text-muted-foreground">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${act.cls}`}>
                            {act.label}
                          </span>
                          <span className="text-sm font-semibold">
                            {TABLE_AR[r.entity_table] ?? r.entity_table}
                          </span>
                          {r.entity_id && (
                            <span className="font-mono text-[10px] text-muted-foreground">#{r.entity_id.slice(0, 8)}</span>
                          )}
                          {r.action === "UPDATE" && changed.length > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              ({changed.length} حقل تغيّر)
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>{new Date(r.created_at).toLocaleString("ar-EG-u-nu-latn")}</span>
                          <span>•</span>
                          <span>{r.actor_email || r.actor_id?.slice(0, 8) || "نظام"}</span>
                          {r.ip_address && (<><span>•</span><span dir="ltr">{r.ip_address}</span></>)}
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="mt-3 mr-7 space-y-3 rounded-xl bg-secondary/30 p-3 text-xs">
                        {r.action === "UPDATE" && changed.length > 0 && (
                          <div>
                            <div className="mb-2 font-semibold">الحقول المتغيّرة:</div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-[11px]">
                                <thead className="text-muted-foreground">
                                  <tr>
                                    <th className="p-1.5 text-right">الحقل</th>
                                    <th className="p-1.5 text-right">قبل</th>
                                    <th className="p-1.5 text-right">بعد</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {changed.map((f) => (
                                    <tr key={f} className="border-t border-border/50">
                                      <td className="p-1.5 font-mono">{f}</td>
                                      <td className="p-1.5 text-destructive break-all">{formatVal(r.before_data?.[f])}</td>
                                      <td className="p-1.5 text-emerald-600 break-all">{formatVal(r.after_data?.[f])}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {(r.action === "INSERT" || r.action === "DELETE" || r.action === "UPDATE") && (
                          <div className="grid gap-2 md:grid-cols-2">
                            {r.before_data && (
                              <div>
                                <div className="mb-1 font-semibold text-destructive">قبل:</div>
                                <pre dir="ltr" className="max-h-64 overflow-auto rounded-lg bg-background p-2 text-[10px]">
                                  {JSON.stringify(r.before_data, null, 2)}
                                </pre>
                              </div>
                            )}
                            {r.after_data && (
                              <div>
                                <div className="mb-1 font-semibold text-emerald-600">بعد:</div>
                                <pre dir="ltr" className="max-h-64 overflow-auto rounded-lg bg-background p-2 text-[10px]">
                                  {JSON.stringify(r.after_data, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}

                        {r.user_agent && (
                          <div className="text-[10px] text-muted-foreground break-all">
                            <span className="font-semibold">المتصفح: </span>
                            <span dir="ltr">{r.user_agent}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminAudit;
