import { Header } from "@/components/Header";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { stageLabel } from "@/lib/crm";

export default function CrmUnassigned() {
  const { isAdmin, isLeasingManager, loading } = useAuth();
  const allowed = isAdmin || isLeasingManager;
  const navigate = useNavigate();
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");

  const agentsQ = useQuery({
    queryKey: ["crm-agents"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id").eq("role", "sales_agent").eq("is_active", true);
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [] as { user_id: string; display_name: string }[];
      const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ids);
      return ids.map((user_id) => ({ user_id, display_name: profiles?.find((p) => p.user_id === user_id)?.display_name ?? "وسيط" }));
    },
  });

  const unassignedQ = useQuery({
    queryKey: ["crm-unassigned"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunities").select("id, stage, source, created_at, parties(name_ar, tenant_code)").is("owner_user_id", null).is("outcome", null).order("created_at").range(0, 99);
      if (error) throw error;
      return data ?? [];
    },
  });

  const transfersQ = useQuery({
    queryKey: ["crm-transfers"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("transfer_requests").select("*, opportunities(parties(name_ar))").eq("status", "pending").order("created_at").range(0, 49);
      if (error) throw error;
      return data ?? [];
    },
  });

  const alertsQ = useQuery({
    queryKey: ["crm-alerts"],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunity_alerts").select("*").range(0, 99);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (loading) return null;
  if (!allowed) return <Navigate to="/" replace />;

  const assign = async (oppId: string, toUser: string) => {
    if (!toUser) return;
    const reason = window.prompt("سبب الإسناد (5 أحرف على الأقل)")?.trim();
    if (!reason || reason.length < 5) return;
    const { error } = await supabase.rpc("assign_opportunity", { _opportunity_id: oppId, _to_user: toUser, _reason: reason });
    if (error) toast.error(error.message);
    else { toast.success("تم الإسناد"); void unassignedQ.refetch(); }
  };

  const decideTransfer = async (requestId: string, approve: boolean) => {
    const { error } = await supabase.rpc("approve_transfer", { _request_id: requestId, _approve: approve });
    if (error) toast.error(error.message);
    else { toast.success(approve ? "تمت الموافقة على النقل" : "رُفض الطلب"); void transfersQ.refetch(); }
  };

  const bulkReassign = async () => {
    if (!bulkFrom || !bulkTo) { toast.error("حدد المستخدمين"); return; }
    const reason = window.prompt("سبب إعادة التوزيع (5 أحرف على الأقل)")?.trim();
    if (!reason || reason.length < 5) return;
    const { data, error } = await supabase.rpc("bulk_reassign_opportunities", { _from_user: bulkFrom, _to_user: bulkTo, _reason: reason });
    if (error) toast.error(error.message);
    else { toast.success(`نُقلت ${data} فرصة`); void unassignedQ.refetch(); }
  };

  return (
    <><Header/><main dir="rtl" className="container-tight space-y-6 py-8">
      <h1 className="text-2xl font-bold">غير موزّعة وطلبات النقل</h1>

      <section className="space-y-3">
        <h2 className="font-bold">فرص غير موزّعة ({unassignedQ.data?.length ?? 0})</h2>
        {(unassignedQ.data ?? []).map((o) => (
          <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm">
            <button className="font-medium hover:underline" onClick={() => navigate(`/crm/opportunity/${o.id}`)}>
              {(o.parties as { name_ar?: string } | null)?.name_ar ?? "—"}
            </button>
            <span className="text-muted-foreground">{stageLabel(o.stage)}</span>
            <select className="rounded-lg border border-border bg-background px-2 py-1 text-sm" defaultValue="" onChange={(e) => { if (e.target.value) void assign(o.id, e.target.value); e.target.value = ""; }}>
              <option value="" disabled>إسناد إلى…</option>
              {(agentsQ.data ?? []).map((a) => <option key={a.user_id} value={a.user_id}>{a.display_name}</option>)}
            </select>
          </div>
        ))}
        {unassignedQ.data?.length === 0 && <p className="text-sm text-muted-foreground">لا فرص غير موزّعة</p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">طلبات نقل الملكية ({transfersQ.data?.length ?? 0})</h2>
        {(transfersQ.data ?? []).map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm">
            <span>{((t.opportunities as { parties?: { name_ar?: string } } | null)?.parties?.name_ar) ?? "—"}</span>
            <span className="text-muted-foreground">{t.reason}</span>
            <Button size="sm" onClick={() => decideTransfer(t.id, true)}>موافقة</Button>
            <Button size="sm" variant="outline" onClick={() => decideTransfer(t.id, false)}>رفض</Button>
          </div>
        ))}
        {transfersQ.data?.length === 0 && <p className="text-sm text-muted-foreground">لا طلبات معلقة</p>}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-bold">إعادة توزيع جماعي (مغادرة وسيط)</h2>
        <div className="flex flex-wrap gap-2">
          <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" value={bulkFrom} onChange={(e) => setBulkFrom(e.target.value)}>
            <option value="">من وسيط…</option>
            {(agentsQ.data ?? []).map((a) => <option key={a.user_id} value={a.user_id}>{a.display_name}</option>)}
          </select>
          <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm" value={bulkTo} onChange={(e) => setBulkTo(e.target.value)}>
            <option value="">إلى وسيط…</option>
            {(agentsQ.data ?? []).map((a) => <option key={a.user_id} value={a.user_id}>{a.display_name}</option>)}
          </select>
          <Button onClick={bulkReassign}>نقل الكل</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">تنبيهات المتابعة ({alertsQ.data?.length ?? 0})</h2>
        {(alertsQ.data ?? []).map((a) => (
          <button key={a.id} onClick={() => navigate(`/crm/opportunity/${a.id}`)} className="block w-full rounded-lg border border-destructive/40 bg-card p-3 text-right text-sm">
            {a.alert_kind} — {stageLabel(a.stage)} — الإجراء: {a.next_action ?? "غير محدد"}
          </button>
        ))}
        {alertsQ.data?.length === 0 && <p className="text-sm text-muted-foreground">لا تنبيهات</p>}
      </section>
      <Input className="hidden" aria-hidden readOnly />
    </main></>
  );
}
