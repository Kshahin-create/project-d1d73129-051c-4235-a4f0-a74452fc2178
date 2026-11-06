import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { exportRowsToCSV, exportRowsToExcel } from "@/lib/exportData";

type AuditPageRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_table: string;
  entity_id: string;
  total_count: number;
};

type Filters = { actor: string; entity: string; action: string; from: string; to: string };

const EMPTY: Filters = { actor: "", entity: "", action: "", from: "", to: "" };

export default function SystemAuditLog() {
  const auth = useAuth();
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const pageSize = 50;

  const q = useQuery({
    queryKey: ["system-audit-log", filters, page],
    enabled: auth.isAdmin,
    queryFn: async () => {
      const r = await supabase.rpc("admin_audit_log_page", {
        p_actor_email: filters.actor || null,
        p_entity_table: filters.entity || null,
        p_action: filters.action || null,
        p_from: filters.from ? new Date(filters.from).toISOString() : null,
        p_to: filters.to ? new Date(`${filters.to}T23:59:59`).toISOString() : null,
        p_page: page + 1,
        p_page_size: pageSize,
      });
      if (r.error) throw r.error;
      const rows = (r.data ?? []) as AuditPageRow[];
      return { rows, total: rows[0]?.total_count ?? 0 };
    },
  });

  if (auth.loading) return null;
  if (!auth.isAdmin) return <Navigate to="/auth" replace />;

  const applyFilters = () => {
    setPage(0);
    setFilters(draft);
  };

  const exportAll = async (format: "csv" | "xlsx") => {
    setExporting(true);
    let exportId: string | undefined;
    try {
      const start = await supabase.rpc("request_admin_export", { _list: "audit_log", _format: format, _scope: { ...filters } });
      if (start.error) throw start.error;
      exportId = String(start.data);
      const all: Record<string, unknown>[] = [];
      for (let p = 1; ; p++) {
        const r = await supabase.rpc("admin_audit_log_page", {
          p_actor_email: filters.actor || null,
          p_entity_table: filters.entity || null,
          p_action: filters.action || null,
          p_from: filters.from ? new Date(filters.from).toISOString() : null,
          p_to: filters.to ? new Date(`${filters.to}T23:59:59`).toISOString() : null,
          p_page: p,
          p_page_size: 200,
        });
        if (r.error) throw r.error;
        const part = (r.data ?? []) as AuditPageRow[];
        all.push(
          ...part.map((row) => ({
            الوقت: new Date(row.created_at).toLocaleString("ar-SA"),
            المستخدم: row.actor_email ?? "النظام",
            الدور: row.actor_role ?? "",
            الإجراء: row.action,
            الكيان: row.entity_table,
            السجل: row.entity_id,
          })),
        );
        if (part.length < 200) break;
      }
      if (format === "xlsx") exportRowsToExcel(all, "سجل النظام", "السجل", [{ الفلاتر: JSON.stringify(filters), العدد: all.length }]);
      else exportRowsToCSV(all, "سجل النظام");
      const finish = await supabase.rpc("complete_admin_export", { _id: exportId, _status: "generated", _count: all.length });
      if (finish.error) throw finish.error;
      toast.success(`تم تصدير ${all.length} سجل`);
    } catch (e) {
      if (exportId) await supabase.rpc("complete_admin_export", { _id: exportId, _status: "failed", _count: 0 });
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const total = q.data?.total ?? 0;

  return (
    <>
      <Header />
      <main dir="rtl" className="container-tight space-y-6 py-8">
        <h1 className="text-2xl font-bold">سجل النظام</h1>
        <p className="text-sm text-muted-foreground">كل الإجراءات المدققة في النظام — متاح للأدمن فقط، والتصدير يُسجَّل.</p>

        <section aria-label="فلاتر السجل" className="grid gap-2 rounded-md border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Input aria-label="بريد المستخدم" placeholder="بريد المستخدم" value={draft.actor} onChange={(e) => setDraft((d) => ({ ...d, actor: e.target.value }))} />
          <Input aria-label="الكيان" placeholder="الكيان (مثال: units)" value={draft.entity} onChange={(e) => setDraft((d) => ({ ...d, entity: e.target.value }))} />
          <Input aria-label="الإجراء" placeholder="الإجراء" value={draft.action} onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))} />
          <Input aria-label="من تاريخ" type="date" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} />
          <Input aria-label="إلى تاريخ" type="date" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} />
          <Button onClick={applyFilters}>تطبيق</Button>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={exporting || !total} onClick={() => void exportAll("xlsx")}>
            <Download className="h-4 w-4" /> تصدير XLSX
          </Button>
          <Button variant="outline" disabled={exporting || !total} onClick={() => void exportAll("csv")}>
            <Download className="h-4 w-4" /> تصدير CSV
          </Button>
          <span className="text-xs text-muted-foreground">{total.toLocaleString("ar-SA")} سجل مطابق</span>
        </div>

        {q.isError && <p role="alert" className="text-destructive">تعذر تحميل السجل: {(q.error as Error).message}</p>}
        {q.isPending ? (
          <p role="status">جارٍ التحميل…</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-card">
                  <th className="whitespace-nowrap p-3 text-right">الوقت</th>
                  <th className="whitespace-nowrap p-3 text-right">المستخدم</th>
                  <th className="whitespace-nowrap p-3 text-right">الإجراء</th>
                  <th className="whitespace-nowrap p-3 text-right">الكيان</th>
                  <th className="whitespace-nowrap p-3 text-right">السجل</th>
                </tr>
              </thead>
              <tbody>
                {q.data?.rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="whitespace-nowrap p-3">{new Date(row.created_at).toLocaleString("ar-SA")}</td>
                    <td className="break-all p-3">{row.actor_email ?? "النظام"}</td>
                    <td className="p-3">{row.action}</td>
                    <td className="p-3">{row.entity_table}</td>
                    <td className="break-all p-3 text-xs text-muted-foreground">{row.entity_id}</td>
                  </tr>
                ))}
                {!q.data?.rows.length && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">لا توجد سجلات مطابقة</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button variant="outline" disabled={!page} onClick={() => setPage((p) => p - 1)}>السابق</Button>
          <span className="text-sm">صفحة {page + 1} / {Math.max(1, Math.ceil(total / pageSize))}</span>
          <Button variant="outline" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((p) => p + 1)}>التالي</Button>
        </div>
      </main>
    </>
  );
}
