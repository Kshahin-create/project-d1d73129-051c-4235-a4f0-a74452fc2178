import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { OPEN_STAGES, PARKED_STAGES, STAGE_LABELS, SOURCE_LABELS, stageLabel, isOverdue } from "@/lib/crm";
import { exportRowsToExcel } from "@/lib/exportData";
import { Header } from "@/components/Header";
import { AdminServerList } from "@/components/admin/AdminServerList";
import { adminLists } from "@/lib/adminData";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

type OppRow = {
  id: string;
  stage: string;
  source: string;
  next_action: string | null;
  next_action_at: string | null;
  no_answer_attempts: number;
  owner_user_id: string | null;
  party_id: string;
  created_at: string;
  parties: { name_ar: string; tenant_code: string } | null;
};

const PAGE_SIZE = 25;
const BOARD_STAGES = [...OPEN_STAGES, "won", ...PARKED_STAGES] as const;

async function fetchOwnerNames(ownerIds: string[]): Promise<Record<string, string>> {
  if (ownerIds.length === 0) return {};
  const { data } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ownerIds);
  const map: Record<string, string> = {};
  for (const p of data ?? []) map[p.user_id] = p.display_name || "بدون اسم";
  return map;
}

export default function CrmPipeline() {
  const { isAdmin, isManager, isLeasingManager, isSalesAgent, loading } = useAuth();
  const allowed = isAdmin || isManager || isLeasingManager || isSalesAgent;
  const navigate = useNavigate();
  const [view, setView] = useState<"board" | "list">("board");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");

  const {user}=useAuth();
  const q = useQuery({ queryKey: ["crm-open-opportunities",user?.id,page,search,stageFilter,sourceFilter,ownerFilter], enabled: allowed, queryFn: async()=>{const r=await supabase.rpc("admin_pipeline_page",{_search:search,_stage:stageFilter,_source:sourceFilter,_owner:ownerFilter,_limit:25,_offset:page*25});if(r.error)throw r.error;return r.data as unknown as {rows:OppRow[];count:number};} });
  const ownerIds = useMemo(
    () => [...new Set((q.data?.rows ?? []).map((o) => o.owner_user_id).filter((x): x is string => !!x))],
    [q.data],
  );
  const ownersQ = useQuery({ queryKey: ["crm-owner-names", ownerIds], enabled: ownerIds.length > 0, queryFn: () => fetchOwnerNames(ownerIds) });

  const filtered=q.data?.rows??[];
  const byStage = useMemo(() => {
    const map: Record<string, OppRow[]> = {};
    for (const s of BOARD_STAGES) map[s] = [];
    for (const o of filtered) if (map[o.stage]) map[o.stage].push(o);
    return map;
  }, [filtered]);

  if (loading) return null;
  if (!allowed) return <Navigate to="/" replace />;

  const move = async (oppId: string, toStage: string) => {
    if(isManager)return;
    const reason = window.prompt(`سبب النقل إلى «${stageLabel(toStage)}» (5 أحرف على الأقل)`)?.trim();
    if (!reason || reason.length < 5) return;
    let revisitAt: string | null = null;
    if (toStage === "postponed") {
      revisitAt = window.prompt("تاريخ إعادة الزيارة (مثال 2026-12-01)")?.trim() ?? null;
      if (!revisitAt) return;
    }
    const { error } = await supabase.rpc("move_opportunity", {
      _opportunity_id: oppId,
      _to_stage: toStage as never,
      _reason: reason,
      _revisit_at: revisitAt,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("تم نقل الفرصة");
      void q.refetch();
    }
  };

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const ownerName = (id: string | null) => (id ? (ownersQ.data?.[id] ?? "…") : "غير موزّعة");

  return (
    <><Header/><main dir="rtl" className="container-tight space-y-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">لوحة الفرص</h1>
        <div className="flex gap-2">
          <Button variant={view === "board" ? "default" : "outline"} onClick={() => setView("board")}>لوحة المراحل</Button>
          <Button variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")}>قائمة</Button>
        </div>
      </div>

      {view==="board"&&<div className="flex flex-wrap gap-3">
        <Input className="max-w-xs" placeholder="بحث بالاسم أو الكود" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" value={stageFilter} onChange={(e) => { setStageFilter(e.target.value); setPage(0); }}>
          <option value="">كل المراحل</option>
          {BOARD_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
        <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }}>
          <option value="">كل المصادر</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" value={ownerFilter} onChange={(e) => { setOwnerFilter(e.target.value); setPage(0); }}>
          <option value="">كل الملاك</option>
          <option value="none">غير موزّعة</option>
          {ownerIds.map((id) => <option key={id} value={id}>{ownerName(id)}</option>)}
        </select>
        
      </div>

      }
      {q.isError && <p role="alert" className="text-destructive">تعذر تحميل الفرص</p>}

      {view === "board" && !q.isError && (
        <div className="flex items-start gap-3 overflow-x-auto pb-4">
          {BOARD_STAGES.map((stage) => (
            <div
              key={stage}
              className="flex min-h-48 w-64 shrink-0 flex-col gap-2 rounded-md border border-border bg-card p-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (id) void move(id, stage);
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">{STAGE_LABELS[stage]}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{byStage[stage]?.length ?? 0}</span>
              </div>
              {(byStage[stage] ?? []).map((o) => (
                <button
                  key={o.id}
                  draggable={!isManager}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", o.id)}
                  onClick={() => navigate(`/admin/opportunities/${o.id}`)}
                  className={cn(
                    "cursor-grab rounded-lg border border-border bg-background p-2 text-right text-sm transition hover:border-primary",
                    isOverdue(o.next_action_at) && "border-destructive/50",
                  )}
                >
                  <Link className="font-medium text-primary hover:underline" to={`/admin/parties/${o.party_id}`} onClick={e=>e.stopPropagation()}>{o.parties?.name_ar ?? "—"}</Link>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{o.parties?.tenant_code}</span>
                    <span>{ownerName(o.owner_user_id)}</span>
                  </div>
                  {isOverdue(o.next_action_at) && <div className="mt-1 text-xs text-destructive">متابعة متأخرة</div>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {view==="board"&&<p className="text-xs text-muted-foreground">المرحلة الأولى · {q.data?.count??0} فرصة مطابقة · آخر تحديث {q.dataUpdatedAt?new Date(q.dataUpdatedAt).toLocaleString("ar-SA"):"—"}</p>}
      {view === "board"&&<div className="flex gap-3"><Button variant="outline" disabled={!page} onClick={()=>setPage(p=>p-1)}>السابق</Button><span>صفحة {page+1}</span><Button variant="outline" disabled={(page+1)*25>=(q.data?.count??0)} onClick={()=>setPage(p=>p+1)}>التالي</Button></div>}
      {view === "list" && <AdminServerList spec={adminLists.opportunities} filters={{...(stageFilter?{stage:stageFilter}:{}),...(sourceFilter?{source:sourceFilter}:{}),...(ownerFilter&&ownerFilter!=="none"?{owner_user_id:ownerFilter}:{})}} onFilters={f=>{setStageFilter(f.stage??"");setSourceFilter(f.source??"");setOwnerFilter(f.owner_user_id??"");}}/>}

    </main></>
  );
}
