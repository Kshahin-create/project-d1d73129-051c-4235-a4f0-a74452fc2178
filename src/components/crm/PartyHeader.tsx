import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, CalendarPlus, ChevronDown, MessageCircle, MessageSquarePlus, Pencil, Phone, Undo2, UserCog, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { recordHref } from "@/lib/adminNavigation";
import { formatDateTime } from "@/lib/format";
import { CLOSE_REASON_LABELS, ID_TYPE_LABELS, rpcOrThrow, sourceLabel, type PartyRow } from "@/lib/partyDirectory";
import { STAGE_LABELS } from "@/lib/crm";
import { PartyStatusBadge } from "./PartyDirectory";
import { ClosePartyDialog, DuplicateDialog, EditPartyDialog, LogContactDialog, MergeDialog, OwnerDialog, ReasonDialog } from "./PartyDialogs";

type Merge = { id: string; from_party_id: string; into_party_id: string; reason: string; merged_at: string; from: { tenant_code: string; name_ar: string } | null };
type DialogKey = "edit" | "log" | "close" | "dup" | "merge" | "owner" | "dnc" | "restore" | `unmerge:${string}` | null;

export function PartyHeader({ id }: { id: string }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const canWrite = auth.can("opportunities.write", "edit") || auth.can("opportunities.write", "own");
  const canManage = auth.can("opportunities.write", "edit");
  const canAssign = auth.can("opportunities.assign", "edit");
  const [dialog, setDialog] = useState<DialogKey>(null);
  const q = useQuery({ queryKey: ["party-get", id, auth.user?.id], queryFn: () => rpcOrThrow<PartyRow>("party_get", { _id: id }) });
  const merges = useQuery({
    queryKey: ["party-merges", id], enabled: auth.isAdmin,
    queryFn: async () => {
      const r = await supabase.from("party_merges").select("id,from_party_id,into_party_id,reason,merged_at,from:parties!party_merges_from_party_id_fkey(tenant_code,name_ar)").eq("into_party_id", id).is("undone_at", null).order("merged_at", { ascending: false });
      if (r.error) throw r.error;
      return r.data as unknown as Merge[];
    },
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["party-get", id] }); void qc.invalidateQueries({ queryKey: ["party-history", id] }); void qc.invalidateQueries({ queryKey: ["party-merges", id] }); void qc.invalidateQueries({ queryKey: ["admin-record"] }); void qc.invalidateQueries({ queryKey: ["party-activity"] }); };
  const close = (o: boolean) => { if (!o) setDialog(null); };

  if (q.isError) return <p role="alert" className="text-destructive">{(q.error as Error).message}</p>;
  if (!q.data) return <div className="h-28 animate-pulse rounded-lg bg-muted" />;
  const p = q.data;
  const phoneDigits = (p.phone ?? "").replace(/\D/g, "");
  const waNumber = phoneDigits.startsWith("05") ? `966${phoneDigits.slice(1)}` : phoneDigits;
  const reachable = p.contact_visible && !!p.phone && !p.do_not_contact;
  const newOpportunity = async () => {
    try {
      const oid = await rpcOrThrow<string>("create_opportunity", { _party_id: p.id, _source: "call" });
      toast.success("اتفتحت فرصة جديدة");
      refresh();
      if (typeof oid === "string") window.location.assign(recordHref("opportunities", oid));
    } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر فتح فرصة"); }
  };

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5" aria-label="ملخص العميل">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <PartyStatusBadge status={p.status} />
            <span className="text-sm text-muted-foreground" dir="ltr">{p.tenant_code}</span>
            {p.do_not_contact && <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" />لا يُتواصل معه</Badge>}
            {p.status === "closed" && p.close_reason && <Badge variant="outline">سبب القفل: {CLOSE_REASON_LABELS[p.close_reason] ?? p.close_reason}</Badge>}
          </div>
          <h2 className="text-xl font-bold">{p.name_ar}</h2>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <div className="flex gap-1.5"><dt className="text-muted-foreground">الجوال:</dt><dd dir="ltr" className="tabular-nums">{p.contact_visible ? (p.phone ?? "—") : "مخفي"}</dd></div>
            {p.contact_visible && p.id_number && <div className="flex gap-1.5"><dt className="text-muted-foreground">{ID_TYPE_LABELS[p.id_type ?? ""] ?? "الهوية"}:</dt><dd dir="ltr" className="tabular-nums">{p.id_number}</dd></div>}
            <div className="flex gap-1.5"><dt className="text-muted-foreground">المسؤول:</dt><dd>{p.owner_name ?? "بدون (القائمة المشتركة)"}</dd></div>
            <div className="flex gap-1.5"><dt className="text-muted-foreground">آخر تواصل:</dt><dd className="tabular-nums">{formatDateTime(p.last_contact_at)}</dd></div>
            <div className="flex gap-1.5"><dt className="text-muted-foreground">المصدر:</dt><dd>{sourceLabel(p.source)}</dd></div>
          </dl>
          {p.open_opportunity && <p className="text-sm">فرصة مفتوحة: <Link className="text-primary hover:underline" to={recordHref("opportunities", p.open_opportunity.id)}>{STAGE_LABELS[p.open_opportunity.stage as keyof typeof STAGE_LABELS] ?? p.open_opportunity.stage}</Link>
            {p.open_opportunity.next_action && <span className="text-muted-foreground"> · الخطوة الجاية: {p.open_opportunity.next_action} ({formatDateTime(p.open_opportunity.next_action_at)})</span>}</p>}
          {p.status === "archived" && (p.duplicate_of_id || p.merged_into_id) && <p className="text-sm">
            {p.merged_into_id ? "اتدمج في" : "مكرر من"} <Link className="text-primary hover:underline" dir="ltr" to={recordHref("parties", (p.merged_into_id ?? p.duplicate_of_id)!)}>{p.duplicate_of_code}</Link></p>}
          {p.do_not_contact && p.do_not_contact_reason && <p className="text-sm text-muted-foreground">سبب عدم التواصل: {p.do_not_contact_reason}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          {reachable && <Button asChild variant="outline" size="sm"><a href={`tel:${p.phone}`}><Phone className="ml-1 h-4 w-4" />اتصال</a></Button>}
          {reachable && <Button asChild variant="outline" size="sm"><a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="ml-1 h-4 w-4" />واتساب</a></Button>}
          {canWrite && p.status !== "archived" && <Button size="sm" variant="outline" onClick={() => setDialog("log")}><MessageSquarePlus className="ml-1 h-4 w-4" />تسجيل تواصل</Button>}
          {p.status !== "archived" && p.status !== "tenant" && <Button size="sm" asChild><Link to={`/booking?party=${p.id}`}><CalendarPlus className="ml-1 h-4 w-4" />حجز وحدة</Link></Button>}
          {canWrite && (
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild><Button size="sm" variant="secondary">إجراءات <ChevronDown className="mr-1 h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onSelect={() => setDialog("edit")}><Pencil className="ml-2 h-4 w-4" />تعديل البيانات</DropdownMenuItem>
                {(canAssign || !p.owner_user_id) && <DropdownMenuItem onSelect={() => setDialog("owner")}><UserCog className="ml-2 h-4 w-4" />{canAssign ? "المسؤول عن العميل" : "استلام العميل"}</DropdownMenuItem>}
                {(p.status === "closed" || (!p.open_opportunity && p.status !== "archived")) && <DropdownMenuItem onSelect={() => void newOpportunity()}>فتح فرصة جديدة</DropdownMenuItem>}
                <DropdownMenuSeparator />
                {!["closed", "archived", "tenant", "booker"].includes(p.status) && <DropdownMenuItem onSelect={() => setDialog("close")}><XCircle className="ml-2 h-4 w-4" />قفل العميل</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => setDialog("dnc")}><Ban className="ml-2 h-4 w-4" />{p.do_not_contact ? "إلغاء «لا يُتواصل معه»" : "لا يُتواصل معه"}</DropdownMenuItem>
                {p.status !== "archived" && <DropdownMenuItem onSelect={() => setDialog("dup")}>تعليم كمكرر</DropdownMenuItem>}
                {canManage && p.duplicate_of_id && !p.merged_into_id && <DropdownMenuItem onSelect={() => setDialog("restore")}><Undo2 className="ml-2 h-4 w-4" />إلغاء علامة المكرر</DropdownMenuItem>}
                {auth.isAdmin && p.status !== "archived" && <DropdownMenuItem className="text-destructive" onSelect={() => setDialog("merge")}>دمج كامل في ملف آخر</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {auth.isAdmin && (merges.data?.length ?? 0) > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm font-semibold">ملفات اتدمجت في الملف ده</p>
          {merges.data!.map(m => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span><Link className="text-primary hover:underline" to={recordHref("parties", m.from_party_id)}>{m.from?.name_ar ?? "ملف"}</Link> <span dir="ltr" className="text-muted-foreground">{m.from?.tenant_code}</span> · {formatDateTime(m.merged_at)} · {m.reason}</span>
              <Button size="sm" variant="outline" onClick={() => setDialog(`unmerge:${m.id}`)}><Undo2 className="ml-1 h-4 w-4" />تراجع عن الدمج</Button>
            </div>
          ))}
        </div>
      )}

      <EditPartyDialog open={dialog === "edit"} onOpenChange={close} party={p} onDone={refresh} />
      <LogContactDialog open={dialog === "log"} onOpenChange={close} partyId={p.id} partyName={p.name_ar} onDone={refresh} />
      <ClosePartyDialog open={dialog === "close"} onOpenChange={close} party={p} onDone={refresh} />
      <DuplicateDialog open={dialog === "dup"} onOpenChange={close} party={p} onDone={refresh} />
      <MergeDialog open={dialog === "merge"} onOpenChange={close} party={p} onDone={refresh} />
      <OwnerDialog open={dialog === "owner"} onOpenChange={close} party={p} canAssign={canAssign} selfId={auth.user?.id} onDone={refresh} />
      <ReasonDialog open={dialog === "dnc"} onOpenChange={close} onDone={refresh}
        title={p.do_not_contact ? "إلغاء «لا يُتواصل معه»" : "لا يُتواصل معه"}
        description={p.do_not_contact ? "العميل هيرجع يظهر في قوائم التواصل." : "العميل مش هيوصله تواصل، والعلامة دي بتفضل حتى لو اترفع تاني في ملف استيراد."}
        confirmLabel="حفظ" destructive={!p.do_not_contact}
        action={reason => rpcOrThrow("party_set_do_not_contact", { _id: p.id, _on: !p.do_not_contact, _reason: reason })} />
      <ReasonDialog open={dialog === "restore"} onOpenChange={close} onDone={refresh} title="إلغاء علامة المكرر"
        description="الملف هيرجع نشط ويتفك ارتباطه بالملف الأصلي." confirmLabel="إلغاء العلامة"
        action={reason => rpcOrThrow("party_restore_duplicate", { _id: p.id, _reason: reason })} />
      <ReasonDialog open={!!dialog?.startsWith("unmerge:")} onOpenChange={close} onDone={refresh} title="تراجع عن الدمج"
        description="كل اللي اتنقل بالدمج هيرجع للملف القديم، والملف القديم هيرجع نشط." confirmLabel="تراجع" destructive
        action={reason => rpcOrThrow("party_unmerge", { _merge_id: dialog!.slice(8), _reason: reason })} />
    </section>
  );
}
