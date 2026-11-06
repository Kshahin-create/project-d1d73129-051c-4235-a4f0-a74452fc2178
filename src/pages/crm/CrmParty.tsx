import { useState } from "react";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { LIFECYCLE_LABELS, SOURCE_LABELS, stageLabel } from "@/lib/crm";
import {PartyActivityPanel} from '@/components/tasks/PartyActivityPanel';
import { formatDateTime } from "@/lib/format";

export default function CrmParty() {
  const params = useParams<{ partyId?: string; id?: string }>();
  const id = params.partyId ?? params.id;
  const { isAdmin, isManager, isLeasingManager, isSalesAgent, loading } = useAuth();
  const allowed = isAdmin || isManager || isLeasingManager || isSalesAgent;
  const canWrite = isAdmin || isLeasingManager || isSalesAgent;
  const navigate = useNavigate();
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactRole, setContactRole] = useState("");

  const partyQ = useQuery({
    queryKey: ["crm-party", id],
    enabled: allowed && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("parties_crm").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const contactsQ = useQuery({
    queryKey: ["crm-party-contacts", id],
    enabled: allowed && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("party_contacts").select("*").eq("party_id", id!).is("archived_at", null).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const oppsQ = useQuery({
    queryKey: ["crm-party-opps", id],
    enabled: allowed && !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunities").select("*").eq("party_id", id!).order("created_at", { ascending: false }).range(0, 49);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (loading) return null;
  if (!allowed) return <Navigate to="/" replace />;

  const party = partyQ.data;

  const addContact = async () => {
    if (contactName.trim().length < 2) { toast.error("اسم جهة الاتصال مطلوب"); return; }
    const { error } = await supabase.from("party_contacts").insert({ party_id: id!, full_name: contactName.trim(), phone: contactPhone || null, role_label: contactRole || null });
    if (error) toast.error(error.message);
    else { toast.success("أُضيفت جهة الاتصال"); setContactName(""); setContactPhone(""); setContactRole(""); void contactsQ.refetch(); }
  };

  const addOpportunity = async () => {
    const { error } = await supabase.rpc("create_opportunity", { _party_id: id!, _source: "agent" as never });
    if (error) toast.error(error.message);
    else { toast.success("فُتحت فرصة جديدة"); void oppsQ.refetch(); }
  };

  return (
    <main dir="rtl" className="container-tight space-y-6 py-8">
      {partyQ.isError && <p role="alert" className="text-destructive">تعذر تحميل العميل</p>}
      {party && (
        <>
          <div>
            <h1 className="text-2xl font-bold">{party.name_ar} <span className="text-sm text-muted-foreground">{party.tenant_code}</span></h1>
            <p className="text-sm text-muted-foreground">
              {party.party_type === "company" ? "شركة" : "فرد"}
              {party.tenant_lifecycle && <> — دورة المستأجر: {LIFECYCLE_LABELS[party.tenant_lifecycle]}</>}
            </p>
          </div>

          <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
            <div><span className="text-xs text-muted-foreground">الجوال</span><p>{party.phone ?? "غير متاح لك"}</p></div>
            <div><span className="text-xs text-muted-foreground">البريد</span><p>{party.email ?? "—"}</p></div>
            <div><span className="text-xs text-muted-foreground">الهوية</span><p>{party.id_number ? `${party.id_type}: ${party.id_number}` : "غير متاحة لك"}</p></div>
            <div><span className="text-xs text-muted-foreground">المدينة</span><p>{party.city ?? "—"}</p></div>
          </div>

          <section className="space-y-3">
            <h2 className="font-bold">جهات الاتصال</h2>
            {(contactsQ.data ?? []).map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-card p-3 text-sm">
                {c.full_name} {c.role_label && <span className="text-muted-foreground">({c.role_label})</span>} {c.phone && <> — {c.phone}</>}
              </div>
            ))}
            {canWrite && (
              <div className="flex flex-wrap gap-2">
                <Input className="max-w-xs" placeholder="الاسم" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                <Input className="max-w-xs" placeholder="الجوال" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                <Input className="max-w-xs" placeholder="الصفة" value={contactRole} onChange={(e) => setContactRole(e.target.value)} />
                <Button onClick={addContact}>إضافة</Button>
              </div>
            )}
          </section>

          <PartyActivityPanel partyId={id??''}/>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">الفرص</h2>
              {canWrite && <Button variant="outline" onClick={addOpportunity}>فرصة جديدة (توسعة)</Button>}
            </div>
            {(oppsQ.data ?? []).map((o) => (
              <button key={o.id} onClick={() => navigate(`/crm/opportunity/${o.id}`)} className="block w-full rounded-lg border border-border bg-card p-3 text-right text-sm hover:border-primary">
                {stageLabel(o.stage)} — {SOURCE_LABELS[o.source] ?? o.source}
                <span className="block text-xs text-muted-foreground">{formatDateTime(o.created_at)}</span>
              </button>
            ))}
            {oppsQ.data?.length === 0 && <p className="text-sm text-muted-foreground">لا فرص بعد</p>}
          </section>
        </>
      )}
    </main>
  );
}
