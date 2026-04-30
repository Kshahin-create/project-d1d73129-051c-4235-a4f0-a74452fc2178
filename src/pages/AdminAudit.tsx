import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { History, Lock, Search, ArrowRight, Filter } from "lucide-react";

interface AuditRow {
  id: string;
  building_number: number;
  unit_number: number;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  reason: string;
  performed_by_email: string | null;
  created_at: string;
  tenant_snapshot: any;
}

const STATUS_AR: Record<string, string> = {
  available: "متاح",
  rented: "مؤجر",
  reserved: "محجوز",
};

const ACTION_AR: Record<string, string> = {
  rent: "تأجير",
  reserve: "حجز",
  release: "إخلاء",
  update: "تعديل",
};

const AdminAudit = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const load = async () => {
    setFetching(true);
    const { data, error } = await supabase
      .from("unit_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error("تعذر التحميل: " + error.message);
    else setRows((data as AuditRow[]) ?? []);
    setFetching(false);
  };

  useEffect(() => {
    if (!loading && isAdmin) load();
  }, [loading, isAdmin]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        String(r.unit_number).includes(q) ||
        String(r.building_number).includes(q) ||
        (r.performed_by_email ?? "").toLowerCase().includes(q) ||
        (r.reason ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, actionFilter]);

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
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">سجل التدقيق</h1>
              <p className="text-sm text-muted-foreground">
                {filtered.length} عملية من إجمالي {rows.length}
              </p>
            </div>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            <ArrowRight className="h-4 w-4" /> رجوع للوحة الأدمن
          </Link>
        </div>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card p-2">
            <Search className="mr-2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم الوحدة، المبنى، البريد، أو السبب..."
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
              <option value="rent">تأجير</option>
              <option value="reserve">حجز</option>
              <option value="release">إخلاء</option>
              <option value="update">تعديل</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          {fetching ? (
            <div className="p-12 text-center text-muted-foreground">جارِ التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا توجد سجلات</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/50 text-xs">
                <tr>
                  <th className="p-3 text-right font-semibold">التاريخ</th>
                  <th className="p-3 text-right font-semibold">الوحدة</th>
                  <th className="p-3 text-right font-semibold">العملية</th>
                  <th className="p-3 text-right font-semibold">من → إلى</th>
                  <th className="p-3 text-right font-semibold">المنفّذ</th>
                  <th className="p-3 text-right font-semibold">السبب</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 align-top">
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("ar-EG")}
                    </td>
                    <td className="p-3 font-medium whitespace-nowrap">
                      مبنى {r.building_number} - وحدة {r.unit_number}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                        {ACTION_AR[r.action] ?? r.action}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      {r.previous_status ? STATUS_AR[r.previous_status] ?? r.previous_status : "—"}
                      {" → "}
                      {r.new_status ? STATUS_AR[r.new_status] ?? r.new_status : "—"}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{r.performed_by_email || "—"}</td>
                    <td className="p-3 text-xs">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminAudit;
