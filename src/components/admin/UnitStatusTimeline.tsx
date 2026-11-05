import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { unitStatusLabel } from "@/lib/unitStatus";
export function UnitStatusTimeline({ unitId }: { unitId: string }) {
  const [page, setPage] = useState(0);
  const q = useQuery({ queryKey: ["unit-status-history", unitId, page], queryFn: async () => {
    const r = await supabase.from("unit_status_history").select("*", { count: "exact" }).eq("unit_id", unitId).order("at", { ascending: false }).order("id").range(page * 20, page * 20 + 19);
    if (r.error) throw r.error;
    return { rows: r.data, total: r.count ?? 0 };
  } });
  return <section dir="rtl" className="space-y-3"><h3 className="font-semibold">سجل حالات الوحدة</h3>
    {q.isPending ? <p role="status">جارٍ تحميل السجل…</p> : q.isError ? <p role="alert" className="text-destructive">تعذر تحميل السجل</p> : <>
      {!q.data?.rows.length && <p className="text-sm text-muted-foreground">لا توجد انتقالات مسجلة بعد نقل الحالة التاريخية.</p>}
      <ol className="border-r border-border pr-4">{q.data?.rows.map(r => <li key={r.id} className="border-b border-border py-3 text-sm"><p className="font-medium">{r.from_status ? unitStatusLabel(r.from_status) : "تسوية الحالة"} ← {unitStatusLabel(r.to_status)}</p><p className="mt-1">{r.reason}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(r.at).toLocaleString("ar-SA")} · {r.actor_role === "admin" ? "الأدمن" : r.actor_role === "control" ? "التحكم" : "النظام"}</p>{r.actor && <p className="break-all text-xs text-muted-foreground">المنفذ: {r.actor}</p>}{r.ref_id && <p className="break-all text-xs text-muted-foreground">المرجع: {r.ref_id}</p>}</li>)}</ol>
      <div className="flex items-center justify-between"><Button variant="outline" size="icon" aria-label="الصفحة السابقة" disabled={!page} onClick={() => setPage(p => p - 1)}><ChevronRight /></Button><span className="text-xs">{page + 1} / {Math.max(1, Math.ceil((q.data?.total ?? 0) / 20))}</span><Button variant="outline" size="icon" aria-label="الصفحة التالية" disabled={(page + 1) * 20 >= (q.data?.total ?? 0)} onClick={() => setPage(p => p + 1)}><ChevronLeft /></Button></div>
    </>}
  </section>;
}