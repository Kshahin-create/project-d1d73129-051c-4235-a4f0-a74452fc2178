import { Header } from "@/components/Header";
import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OUTCOME_LABELS, stageLabel } from "@/lib/crm";
import { exportRowsToExcel } from "@/lib/exportData";
import { Button } from "@/components/ui/button";

type Opp = {
  id: string; owner_user_id: string | null; stage: string; outcome: string | null;
  outcome_reason: string | null; created_at: string; next_action_at: string | null;
};
type Act = { opportunity_id: string; created_at: string };

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(table as never).select(select).range(offset, offset + 499);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as T[]));
    if (!data || data.length < 500) break;
  }
  return rows;
}

export default function CrmTeamPerformance() {
  const { isAdmin, isLeasingManager, loading } = useAuth();
  const allowed = isAdmin || isLeasingManager;

  const oppsQ = useQuery({ queryKey: ["crm-perf-opps"], enabled: allowed, queryFn: () => fetchAll<Opp>("opportunities", "id, owner_user_id, stage, outcome, outcome_reason, created_at, next_action_at") });
  const actsQ = useQuery({ queryKey: ["crm-perf-acts"], enabled: allowed, queryFn: () => fetchAll<Act>("opportunity_activities", "opportunity_id, created_at") });

  const ownerIds = useMemo(() => [...new Set((oppsQ.data ?? []).map((o) => o.owner_user_id).filter((x): x is string => !!x))], [oppsQ.data]);
  const namesQ = useQuery({
    queryKey: ["crm-perf-names", ownerIds],
    enabled: allowed && ownerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ownerIds);
      const map: Record<string, string> = {};
      for (const p of data ?? []) map[p.user_id] = p.display_name || "بدون اسم";
      return map;
    },
  });

  const stats = useMemo(() => {
    const opps = oppsQ.data ?? [];
    const acts = actsQ.data ?? [];
    const firstAct: Record<string, number> = {};
    for (const a of acts) {
      const t = new Date(a.created_at).getTime();
      if (!firstAct[a.opportunity_id] || t < firstAct[a.opportunity_id]) firstAct[a.opportunity_id] = t;
    }
    const now = Date.now();
    const per: Record<string, { open: number; won: number; lost: number; overdue: number; responseHours: number[]; losses: Record<string, number>; toContract: number }> = {};
    for (const o of opps) {
      const key = o.owner_user_id ?? "none";
      per[key] ??= { open: 0, won: 0, lost: 0, overdue: 0, responseHours: [], losses: {}, toContract: 0 };
      const s = per[key];
      if (o.outcome) {
        s.lost += 1;
        s.losses[o.outcome] = (s.losses[o.outcome] ?? 0) + 1;
      } else if (o.stage === "won") s.won += 1;
      else {
        s.open += 1;
        if (!o.next_action_at || new Date(o.next_action_at).getTime() < now) s.overdue += 1;
      }
      if (o.stage === "pending_contract" || o.stage === "won") s.toContract += 1;
      const fa = firstAct[o.id];
      if (fa) s.responseHours.push((fa - new Date(o.created_at).getTime()) / 3_600_000);
    }
    return Object.entries(per).map(([owner, s]) => ({
      owner,
      ...s,
      avgResponse: s.responseHours.length ? s.responseHours.reduce((a, b) => a + b, 0) / s.responseHours.length : null,
    }));
  }, [oppsQ.data, actsQ.data]);

  if (loading) return null;
  if (!allowed) return <Navigate to="/" replace />;

  const name = (id: string) => (id === "none" ? "غير موزّعة" : (namesQ.data?.[id] ?? "…"));

  return (
    <><Header/><main dir="rtl" className="container-tight space-y-5 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">أداء الفريق</h1>
        <Button variant="outline" onClick={() => exportRowsToExcel(stats.map((s) => ({ الوسيط: name(s.owner), مفتوحة: s.open, مستأجر: s.won, مغلقة_خسارة: s.lost, متابعة_متأخرة: s.overdue, وصلت_للعقد: s.toContract, متوسط_أول_رد_ساعات: s.avgResponse?.toFixed(1) ?? "" })), "أداء-الفريق")}>تصدير</Button>
      </div>
      {(oppsQ.isError || actsQ.isError) && <p role="alert" className="text-destructive">تعذر تحميل البيانات</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>الوسيط</TableHead>
            <TableHead>فرص مفتوحة</TableHead>
            <TableHead>مستأجر</TableHead>
            <TableHead>خسارة</TableHead>
            <TableHead>متابعات متأخرة</TableHead>
            <TableHead>وصلت لبانتظار العقد</TableHead>
            <TableHead>متوسط أول رد (ساعة)</TableHead>
            <TableHead>أسباب الخسارة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.map((s) => (
            <TableRow key={s.owner}>
              <TableCell>{name(s.owner)}</TableCell>
              <TableCell>{s.open}</TableCell>
              <TableCell>{s.won}</TableCell>
              <TableCell>{s.lost}</TableCell>
              <TableCell>{s.overdue}</TableCell>
              <TableCell>{s.toContract}</TableCell>
              <TableCell>{s.avgResponse === null ? "—" : s.avgResponse.toFixed(1)}</TableCell>
              <TableCell>{Object.entries(s.losses).map(([k, v]) => `${OUTCOME_LABELS[k] ?? k}: ${v}`).join("، ") || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">النطاق: كل الفرص — آخر تحديث: {new Date().toLocaleString("ar-SA")}</p>
    </main></>
  );
}
