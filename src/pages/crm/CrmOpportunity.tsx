import { useState } from "react";
import { Navigate, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ACTIVITY_OUTCOME_LABELS, ACTIVITY_TYPE_LABELS, LIFECYCLE_LABELS, OPEN_STAGES,
  OUTCOME_LABELS, SOURCE_LABELS, canMoveStage, stageLabel,
} from "@/lib/crm";

export default function CrmOpportunity() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin, isManager, isLeasingManager, isSalesAgent, user, loading } = useAuth();
  const allowed = isAdmin || isManager || isLeasingManager || isSalesAgent;
  const [actType, setActType] = useState("call");
  const [actOutcome, setActOutcome] = useState("answered");
  const [actNotes, setActNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");

  const oppQ = useQuery({
    queryKey: ["crm-opportunity", id],
    enabled: allowed && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunities").select("*, parties(name_ar, tenant_code)").eq("id", id!).single();
      if (error) throw error;
      const { data: party } = await supabase.from("parties_crm").select("*").eq("id", data.party_id).maybeSingle();
      return { opp: data, party };
    },
  });

  const activitiesQ = useQuery({
    queryKey: ["crm-opportunity-activities", id],
    enabled: allowed && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunity_activities").select("*").eq("opportunity_id", id!).order("created_at", { ascending: false }).range(0, 99);
      if (error) throw error;
      return data ?? [];
    },
  });

  const historyQ = useQuery({
    queryKey: ["crm-opportunity-owners", id],
    enabled: allowed && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunity_owner_history").select("*").eq("opportunity_id", id!).order("created_at", { ascending: false }).range(0, 49);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (loading) return null;
  if (!allowed) return <Navigate to="/" replace />;

  const opp = oppQ.data?.opp;
  const party = oppQ.data?.party;
  const isOwner = !!opp && opp.owner_user_id === user?.id;
  const canEdit = isOwner || isLeasingManager || isAdmin;
  const isClosed = !!opp && (opp.outcome !== null || opp.stage === "won");

  const logActivity = async () => {
    const { error } = await supabase.rpc("log_opportunity_activity", {
      _opportunity_id: id!,
      _activity_type: actType as never,
      _outcome: actOutcome as never,
      _notes: actNotes || null,
      _next_action: nextAction || null,
      _next_action_at: nextActionAt ? new Date(nextActionAt).toISOString() : null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("تم تسجيل النشاط");
      setActNotes(""); setNextAction(""); setNextActionAt("");
      void oppQ.refetch(); void activitiesQ.refetch();
    }
  };

  const move = async (toStage: string) => {
    const reason = window.prompt(`سبب النقل إلى «${stageLabel(toStage)}» (5 أحرف على الأقل)`)?.trim();
    if (!reason || reason.length < 5) return;
    let revisitAt: string | null = null;
    if (toStage === "postponed") {
      revisitAt = window.prompt("تاريخ إعادة الزيارة (مثال 2026-12-01)")?.trim() ?? null;
      if (!revisitAt) return;
    }
    const { error } = await supabase.rpc("move_opportunity", { _opportunity_id: id!, _to_stage: toStage as never, _reason: reason, _revisit_at: revisitAt });
    if (error) toast.error(error.message);
    else { toast.success("تم النقل"); void oppQ.refetch(); }
  };

  const close = async (outcome: string) => {
    const reason = window.prompt(`سبب الإغلاق «${OUTCOME_LABELS[outcome]}» (5 أحرف على الأقل)`)?.trim();
    if (!reason || reason.length < 5) return;
    const lostTo = outcome === "chose_other" ? window.prompt("اختار مكانًا آخر — اذكره (اختياري)")?.trim() ?? null : null;
    const { error } = await supabase.rpc("move_opportunity", { _opportunity_id: id!, _to_stage: opp!.stage as never, _reason: reason, _outcome: outcome as never, _outcome_reason: reason, _lost_to: lostTo });
    if (error) toast.error(error.message);
    else { toast.success("تم إغلاق الفرصة"); void oppQ.refetch(); }
  };

  const requestTransfer = async () => {
    const reason = window.prompt("سبب طلب نقل الفرصة إليك (5 أحرف على الأقل)")?.trim();
    if (!reason || reason.length < 5) return;
    const { error } = await supabase.rpc("request_transfer", { _opportunity_id: id!, _reason: reason });
    if (error) toast.error(error.message);
    else toast.success("أُرسل الطلب لمدير التأجير");
  };

  return (
    <main dir="rtl" className="container-tight space-y-6 py-8">
      {oppQ.isError && <p role="alert" className="text-destructive">تعذر تحميل الفرصة</p>}
      {opp && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">
                <Link to={`/crm/party/${opp.party_id}`} className="hover:underline">{party?.name_ar ?? "—"}</Link>
                <span className="mr-2 text-sm text-muted-foreground">{party?.tenant_code}</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                المرحلة: {stageLabel(opp.stage)}
                {opp.outcome && <> — مغلقة: {OUTCOME_LABELS[opp.outcome]} ({opp.outcome_reason})</>}
                {" "}— المصدر: {SOURCE_LABELS[opp.source] ?? opp.source} — محاولات لا يرد: {opp.no_answer_attempts}
              </p>
              {party?.tenant_lifecycle && <p className="text-sm">دورة المستأجر: {LIFECYCLE_LABELS[party.tenant_lifecycle]}</p>}
            </div>
            {isSalesAgent && !isOwner && !isClosed && <Button variant="outline" onClick={requestTransfer}>طلب نقل الملكية</Button>}
          </div>

          <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
            <div><span className="text-xs text-muted-foreground">الجوال</span><p>{party?.phone ?? "غير متاح لك"}</p></div>
            <div><span className="text-xs text-muted-foreground">البريد</span><p>{party?.email ?? "—"}</p></div>
            <div><span className="text-xs text-muted-foreground">الهوية</span><p>{party?.id_number ? `${party.id_type}: ${party.id_number}` : "غير متاحة لك"}</p></div>
            <div><span className="text-xs text-muted-foreground">المدينة</span><p>{party?.city ?? "—"}</p></div>
            <div><span className="text-xs text-muted-foreground">الإجراء القادم</span><p>{opp.next_action ?? "—"} {opp.next_action_at ? `(${new Date(opp.next_action_at).toLocaleString("ar-SA")})` : ""}</p></div>
            <div><span className="text-xs text-muted-foreground">ملاحظات</span><p>{opp.notes ?? "—"}</p></div>
          </div>

          {canEdit && !isClosed && (
            <section className="space-y-3 rounded-xl border border-border bg-card p-4">
              <h2 className="font-bold">نقل المرحلة</h2>
              <div className="flex flex-wrap gap-2">
                {OPEN_STAGES.filter((s) => canMoveStage(opp.stage, s)).map((s) => (
                  <Button key={s} size="sm" variant="outline" onClick={() => move(s)}>{stageLabel(s)}</Button>
                ))}
                {canMoveStage(opp.stage, "won") && <Button size="sm" onClick={() => move("won")}>مستأجر</Button>}
                {canMoveStage(opp.stage, "postponed") && <Button size="sm" variant="outline" onClick={() => move("postponed")}>تأجيل</Button>}
                {canMoveStage(opp.stage, "waitlist") && <Button size="sm" variant="outline" onClick={() => move("waitlist")}>قائمة انتظار</Button>}
              </div>
              <h2 className="pt-2 font-bold">إغلاق الفرصة</h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(OUTCOME_LABELS).map(([k, v]) => (
                  <Button key={k} size="sm" variant="destructive" onClick={() => close(k)}>{v}</Button>
                ))}
              </div>
            </section>
          )}

          {canEdit && !isClosed && (
            <section className="space-y-3 rounded-xl border border-border bg-card p-4">
              <h2 className="font-bold">تسجيل نشاط</h2>
              <div className="flex flex-wrap gap-3">
                <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" value={actType} onChange={(e) => setActType(e.target.value)}>
                  {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" value={actOutcome} onChange={(e) => setActOutcome(e.target.value)}>
                  {Object.entries(ACTIVITY_OUTCOME_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <Input className="max-w-xs" placeholder="ملاحظات" value={actNotes} onChange={(e) => setActNotes(e.target.value)} />
                <Input className="max-w-xs" placeholder="الإجراء القادم" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
                <Input type="datetime-local" value={nextActionAt} onChange={(e) => setNextActionAt(e.target.value)} />
                <Button onClick={logActivity}>تسجيل</Button>
              </div>
            </section>
          )}

          <section className="space-y-2">
            <h2 className="font-bold">سجل الأنشطة</h2>
            {(activitiesQ.data ?? []).map((a) => (
              <div key={a.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                <span className="font-medium">{ACTIVITY_TYPE_LABELS[a.activity_type]}</span> — {ACTIVITY_OUTCOME_LABELS[a.outcome]}
                {a.notes && <> — {a.notes}</>}
                <span className="block text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("ar-SA")}</span>
              </div>
            ))}
            {activitiesQ.data?.length === 0 && <p className="text-sm text-muted-foreground">لا أنشطة بعد</p>}
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">سجل الملكية</h2>
            {(historyQ.data ?? []).map((h) => (
              <div key={h.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                {h.reason}
                <span className="block text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("ar-SA")}</span>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
