import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  UNIT_STATUS_TRANSITION: "تغيير حالة الوحدة",
  INSERT: "إضافة",
  UPDATE: "تعديل",
  CONTRACT_STATE: "حالة العقد",
  RECEIPT_REVERSED: "قيد عكسي",
  EXPORT_GENERATED: "تصدير ملف",
  data_quality_resolve: "معالجة ملاحظة جودة بيانات",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "أدمن",
  manager: "مدير",
  accountant: "محاسب",
  leasing_manager: "مدير التأجير",
  sales_agent: "وسيط مبيعات",
  control: "التحكم",
  system: "النظام",
};

type AuditRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
};

function summarize(row: AuditRow): string {
  const after = row.after_data ?? {};
  const reason = (after.reason as string | undefined) ?? (row.context?.reason as string | undefined);
  const parts: string[] = [];
  if (after.status) parts.push(`الحالة: ${String(after.status)}`);
  if (after.resolution) parts.push(after.resolution === "corrected" ? "تم التصحيح" : "استثناء");
  if (reason) parts.push(String(reason));
  return parts.join(" · ");
}

export function AuditTimeline({ entityTable, entityId }: { entityTable: string; entityId: string }) {
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ["audit-timeline", entityTable, entityId, page],
    enabled: isAdmin,
    queryFn: async () => {
      const r = await supabase
        .from("audit_log")
        .select("id,created_at,actor_email,actor_role,action,before_data,after_data,context", { count: "exact" })
        .eq("entity_table", entityTable)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .range(page * 20, page * 20 + 19);
      if (r.error) throw r.error;
      return { rows: (r.data ?? []) as AuditRow[], total: r.count ?? 0 };
    },
  });

  if (!isAdmin) return <p className="py-4 text-sm text-muted-foreground">سجل التدقيق متاح للأدمن فقط.</p>;

  return (
    <section dir="rtl" className="space-y-3" aria-label="سجل التدقيق الموحد">
      {q.isPending ? (
        <p role="status">جارٍ تحميل السجل…</p>
      ) : q.isError ? (
        <p role="alert" className="text-destructive">تعذر تحميل سجل التدقيق</p>
      ) : (
        <>
          {!q.data.rows.length && <p className="text-sm text-muted-foreground">لا توجد إجراءات مسجلة على هذا السجل.</p>}
          <ol className="border-r border-border pr-4">
            {q.data.rows.map((row) => (
              <li key={row.id} className="border-b border-border py-3 text-sm">
                <p className="font-medium">{ACTION_LABELS[row.action] ?? row.action}</p>
                {summarize(row) && <p className="mt-1 break-words">{summarize(row)}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString("ar-SA")} · {ROLE_LABELS[row.actor_role ?? ""] ?? row.actor_role ?? "النظام"}
                  {row.actor_email ? ` · ${row.actor_email}` : ""}
                </p>
              </li>
            ))}
          </ol>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" aria-label="الصفحة السابقة" disabled={!page} onClick={() => setPage((p) => p - 1)}>
              <ChevronRight />
            </Button>
            <span className="text-xs">{page + 1} / {Math.max(1, Math.ceil(q.data.total / 20))}</span>
            <Button variant="outline" size="icon" aria-label="الصفحة التالية" disabled={(page + 1) * 20 >= q.data.total} onClick={() => setPage((p) => p + 1)}>
              <ChevronLeft />
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
