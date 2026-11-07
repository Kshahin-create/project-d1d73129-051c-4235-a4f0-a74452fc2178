import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACTIVITY_OUTCOME_LABELS, ACTIVITY_TYPE_LABELS } from "@/lib/crm";
import { recordHref } from "@/lib/adminNavigation";
import {
  CLOSE_REASON_LABELS, ID_TYPE_LABELS, PARTY_STATUS_LABELS, rpcOrThrow,
  type CloseReason, type DirectoryPage, type PartyRow, type StaffOption,
} from "@/lib/partyDirectory";

type Base = { open: boolean; onOpenChange: (open: boolean) => void; onDone?: () => void };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر تنفيذ العملية"); } finally { setBusy(false); }
  };
  return { busy, run };
}

/* ---------- Add customer (single entry point with duplicate check) ---------- */
export function AddPartyDialog({ open, onOpenChange, onDone, interested, title }: Base & { interested?: boolean; title?: string }) {
  const navigate = useNavigate();
  const { busy, run } = useBusy();
  const [name, setName] = useState(""), [phone, setPhone] = useState(""), [idType, setIdType] = useState("none"),
    [idNumber, setIdNumber] = useState(""), [partyType, setPartyType] = useState("individual"), [city, setCity] = useState("");
  useEffect(() => { if (open) { setName(""); setPhone(""); setIdType("none"); setIdNumber(""); setPartyType("individual"); setCity(""); } }, [open]);
  const submit = () => run(async () => {
    const r = await rpcOrThrow<{ status: string; party_id: string; tenant_code: string }>("party_upsert", {
      _name: name, _phone: phone || null, _id_type: idType === "none" ? null : idType, _id_number: idNumber || null,
      _party_type: partyType, _city: city || null, _source: "manual", _interested: !!interested,
    });
    onOpenChange(false);
    if (r.status === "exists") {
      toast.info(`العميل موجود بالفعل (${r.tenant_code}) — فتحنا ملفه بدل ما نعمل ملف جديد`);
      navigate(recordHref("parties", r.party_id));
      return;
    }
    toast.success(`اتضاف العميل ${r.tenant_code}`, { action: { label: "فتح الملف", onClick: () => navigate(recordHref("parties", r.party_id)) } });
    onDone?.();
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>{title ?? "إضافة عميل"}</DialogTitle>
          <DialogDescription>لو الجوال أو رقم الهوية مسجلين قبل كده، هيتفتح ملف العميل الموجود.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الاسم"><Input value={name} onChange={e => setName(e.target.value)} autoFocus /></Field>
          <Field label="الجوال"><Input dir="ltr" inputMode="tel" placeholder="05xxxxxxxx" value={phone} onChange={e => setPhone(e.target.value)} /></Field>
          <Field label="نوع الهوية">
            <Select value={idType} onValueChange={setIdType} dir="rtl"><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">بدون</SelectItem>{Object.entries(ID_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
          </Field>
          <Field label="رقم الهوية / السجل"><Input dir="ltr" inputMode="numeric" value={idNumber} onChange={e => setIdNumber(e.target.value)} disabled={idType === "none"} /></Field>
          <Field label="نوع العميل">
            <Select value={partyType} onValueChange={setPartyType} dir="rtl"><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="individual">فرد</SelectItem><SelectItem value="company">شركة / مؤسسة</SelectItem></SelectContent></Select>
          </Field>
          <Field label="المدينة"><Input value={city} onChange={e => setCity(e.target.value)} /></Field>
        </div>
        <DialogFooter><Button disabled={busy || name.trim().length < 2 || (!phone.trim() && !idNumber.trim())} onClick={submit}>{busy ? "جارٍ الحفظ…" : "حفظ"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Edit customer data (no approval, every change logged before/after) ---------- */
export function EditPartyDialog({ open, onOpenChange, onDone, party }: Base & { party: PartyRow }) {
  const { busy, run } = useBusy();
  const initial = { name_ar: party.name_ar ?? "", name_en: party.name_en ?? "", party_type: party.party_type, id_type: party.id_type ?? "none", id_number: party.id_number ?? "", phone: party.phone ?? "", email: party.email ?? "", city: party.city ?? "" };
  const [form, setForm] = useState(initial);
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) { setForm(initial); setReason(""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const contactKeys = ["phone", "email", "id_type", "id_number"];
  const patch = Object.fromEntries(Object.entries(form)
    .filter(([k, v]) => v !== (initial as Record<string, string>)[k] && (party.contact_visible || !contactKeys.includes(k)))
    .map(([k, v]) => [k, k === "id_type" && v === "none" ? null : v]));
  const submit = () => run(async () => {
    await rpcOrThrow("party_update", { _id: party.id, _patch: patch, _reason: reason || null });
    toast.success("اتحفظت التعديلات واتسجلت في سجل العميل");
    onOpenChange(false); onDone?.();
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>تعديل بيانات العميل</DialogTitle><DialogDescription>كل تعديل بيتسجل في سجل العميل بالقيمة قبل وبعد.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الاسم"><Input value={form.name_ar} onChange={e => set("name_ar")(e.target.value)} /></Field>
          <Field label="الاسم بالإنجليزي"><Input dir="ltr" value={form.name_en} onChange={e => set("name_en")(e.target.value)} /></Field>
          <Field label="نوع العميل">
            <Select value={form.party_type} onValueChange={set("party_type")} dir="rtl"><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="individual">فرد</SelectItem><SelectItem value="company">شركة / مؤسسة</SelectItem></SelectContent></Select>
          </Field>
          <Field label="المدينة"><Input value={form.city} onChange={e => set("city")(e.target.value)} /></Field>
          {party.contact_visible ? <>
            <Field label="الجوال"><Input dir="ltr" inputMode="tel" value={form.phone} onChange={e => set("phone")(e.target.value)} /></Field>
            <Field label="البريد"><Input dir="ltr" type="email" value={form.email} onChange={e => set("email")(e.target.value)} /></Field>
            <Field label="نوع الهوية">
              <Select value={form.id_type} onValueChange={set("id_type")} dir="rtl"><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">بدون</SelectItem>{Object.entries(ID_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
            </Field>
            <Field label="رقم الهوية / السجل"><Input dir="ltr" value={form.id_number} onChange={e => set("id_number")(e.target.value)} /></Field>
          </> : <p className="text-sm text-muted-foreground sm:col-span-2">بيانات التواصل والهوية مش متاحة لحسابك على العميل ده.</p>}
          <div className="sm:col-span-2"><Field label="سبب التعديل (اختياري)"><Input value={reason} onChange={e => setReason(e.target.value)} /></Field></div>
        </div>
        <DialogFooter><Button disabled={busy || Object.keys(patch).length === 0} onClick={submit}>{busy ? "جارٍ الحفظ…" : "حفظ التعديلات"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Log a contact attempt ---------- */
export function LogContactDialog({ open, onOpenChange, onDone, partyId, partyName, defaultOutcome = "answered" }: Base & { partyId: string; partyName?: string; defaultOutcome?: string }) {
  const { busy, run } = useBusy();
  const [type, setType] = useState("call"), [outcome, setOutcome] = useState(defaultOutcome), [notes, setNotes] = useState(""), [next, setNext] = useState(""), [at, setAt] = useState("");
  useEffect(() => { if (open) { setType("call"); setOutcome(defaultOutcome); setNotes(""); setNext(""); setAt(""); } }, [open, defaultOutcome]);
  const submit = () => run(async () => {
    await rpcOrThrow("log_party_activity", { _party: partyId, _type: type, _outcome: outcome, _notes: notes || null, _next: next || null, _at: at ? new Date(at).toISOString() : null });
    toast.success("اتسجل التواصل");
    onOpenChange(false); onDone?.();
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>تسجيل تواصل{partyName ? ` — ${partyName}` : ""}</DialogTitle>
          <DialogDescription>بعد 10 محاولات «لم يرد» العميل بيتقفل تلقائيًا بسبب «لا يرد».</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="نوع التواصل"><Select value={type} onValueChange={setType} dir="rtl"><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="النتيجة"><Select value={outcome} onValueChange={setOutcome} dir="rtl"><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(ACTIVITY_OUTCOME_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></Field>
          <div className="sm:col-span-2"><Field label="ملاحظة"><Textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000} /></Field></div>
          <Field label="الخطوة الجاية (اختياري)"><Input value={next} onChange={e => setNext(e.target.value)} /></Field>
          <Field label="موعدها"><Input type="datetime-local" value={at} onChange={e => setAt(e.target.value)} /></Field>
        </div>
        <DialogFooter><Button disabled={busy || (!!at && !next.trim())} onClick={submit}>{busy ? "جارٍ الحفظ…" : "تسجيل"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Close customer with a listed reason ---------- */
export function ClosePartyDialog({ open, onOpenChange, onDone, party }: Base & { party: PartyRow }) {
  const { busy, run } = useBusy();
  const [reason, setReason] = useState<CloseReason | "">(""), [note, setNote] = useState("");
  useEffect(() => { if (open) { setReason(""); setNote(""); } }, [open]);
  const submit = () => run(async () => {
    await rpcOrThrow("party_close", { _id: party.id, _reason: reason, _note: note || null });
    toast.success("اتقفل العميل. تقدر تفتحله فرصة جديدة بعدين");
    onOpenChange(false); onDone?.();
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader><DialogTitle>قفل العميل</DialogTitle><DialogDescription>العميل ما بيتمسحش، والفرص المفتوحة بتتقفل بنفس السبب.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Field label="السبب"><Select value={reason} onValueChange={v => setReason(v as CloseReason)} dir="rtl"><SelectTrigger><SelectValue placeholder="اختر السبب" /></SelectTrigger>
            <SelectContent>{Object.entries(CLOSE_REASON_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="ملاحظة (اختياري)"><Input value={note} onChange={e => setNote(e.target.value)} /></Field>
        </div>
        <DialogFooter><Button variant="destructive" disabled={busy || !reason} onClick={submit}>{busy ? "جارٍ القفل…" : "قفل العميل"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Pick another customer (for duplicate / merge) ---------- */
function PartyPicker({ excludeId, value, onChange }: { excludeId: string; value: PartyRow | null; onChange: (p: PartyRow | null) => void }) {
  const [search, setSearch] = useState(""), [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  const q = useQuery({
    queryKey: ["party-picker", debounced], enabled: debounced.length >= 2,
    queryFn: () => rpcOrThrow<DirectoryPage>("party_directory_page", { _status: "all", _search: debounced, _limit: 8, _offset: 0 }),
  });
  if (value) return (
    <div className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
      <span>{value.name_ar} · <span dir="ltr">{value.tenant_code}</span></span>
      <Button variant="ghost" size="sm" onClick={() => onChange(null)}>تغيير</Button>
    </div>
  );
  return (
    <div className="space-y-2">
      <Input placeholder="ابحث بالاسم أو الكود أو الجوال" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="max-h-56 space-y-1 overflow-y-auto">
        {q.data?.rows.filter(r => r.id !== excludeId).map(r => (
          <Button key={r.id} variant="outline" className="h-auto w-full justify-between whitespace-normal py-2 text-right" onClick={() => onChange(r)}>
            <span>{r.name_ar}</span><span className="text-xs text-muted-foreground" dir="ltr">{r.tenant_code} · {PARTY_STATUS_LABELS[r.status]}</span>
          </Button>
        ))}
        {debounced.length >= 2 && q.data && q.data.rows.filter(r => r.id !== excludeId).length === 0 && <p className="text-sm text-muted-foreground">لا نتائج</p>}
      </div>
    </div>
  );
}

/* ---------- Mark duplicate (archived and linked to the original) ---------- */
export function DuplicateDialog({ open, onOpenChange, onDone, party }: Base & { party: PartyRow }) {
  const { busy, run } = useBusy();
  const [original, setOriginal] = useState<PartyRow | null>(null), [reason, setReason] = useState("");
  useEffect(() => { if (open) { setOriginal(null); setReason(""); } }, [open]);
  const submit = () => run(async () => {
    await rpcOrThrow("party_mark_duplicate", { _id: party.id, _original: original!.id, _reason: reason });
    toast.success(`اتأرشف الملف واترتبط بالملف الأصلي ${original!.tenant_code}`);
    onOpenChange(false); onDone?.();
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>تعليم كمكرر</DialogTitle><DialogDescription>الملف ده هيتأرشف ويترتبط بالملف الأصلي. نقل الحجوزات والتواصل بيتم بالدمج الكامل من الأدمن.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Field label="الملف الأصلي"><PartyPicker excludeId={party.id} value={original} onChange={setOriginal} /></Field>
          <Field label="السبب"><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="مثال: نفس العميل برقم تاني" /></Field>
        </div>
        <DialogFooter><Button disabled={busy || !original || reason.trim().length < 5} onClick={submit}>{busy ? "جارٍ الحفظ…" : "تعليم كمكرر"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Full merge (admin only, reversible) ---------- */
export function MergeDialog({ open, onOpenChange, onDone, party }: Base & { party: PartyRow }) {
  const { busy, run } = useBusy();
  const navigate = useNavigate();
  const [target, setTarget] = useState<PartyRow | null>(null), [reason, setReason] = useState("");
  useEffect(() => { if (open) { setTarget(null); setReason(""); } }, [open]);
  const submit = () => run(async () => {
    await rpcOrThrow("party_merge", { _from: party.id, _into: target!.id, _reason: reason });
    toast.success(`اتدمج الملف في ${target!.tenant_code}. تقدر تتراجع من ملف العميل الأصلي`);
    onOpenChange(false); onDone?.();
    navigate(recordHref("parties", target!.id));
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>دمج كامل في ملف آخر</DialogTitle>
          <DialogDescription>الحجوزات والفرص والتواصل وجهات الاتصال هتتنقل للملف الأصلي. الملف ده ما بيتمسحش، والدمج ممكن التراجع عنه.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <Field label="الملف الأصلي (اللي هيفضل)"><PartyPicker excludeId={party.id} value={target} onChange={setTarget} /></Field>
          <Field label="السبب"><Input value={reason} onChange={e => setReason(e.target.value)} /></Field>
        </div>
        <DialogFooter><Button variant="destructive" disabled={busy || !target || reason.trim().length < 5} onClick={submit}>{busy ? "جارٍ الدمج…" : "دمج"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Generic reason dialog (do-not-contact, undo merge, restore duplicate) ---------- */
export function ReasonDialog({ open, onOpenChange, onDone, title, description, confirmLabel, destructive, action }: Base & {
  title: string; description: string; confirmLabel: string; destructive?: boolean; action: (reason: string) => Promise<unknown>;
}) {
  const { busy, run } = useBusy();
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  const submit = () => run(async () => { await action(reason); toast.success("تم"); onOpenChange(false); onDone?.(); });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
        <Field label="السبب"><Input value={reason} onChange={e => setReason(e.target.value)} autoFocus /></Field>
        <DialogFooter><Button variant={destructive ? "destructive" : "default"} disabled={busy || reason.trim().length < 5} onClick={submit}>{busy ? "جارٍ الحفظ…" : confirmLabel}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Optional owner ---------- */
export function OwnerDialog({ open, onOpenChange, onDone, party, canAssign, selfId }: Base & { party: PartyRow; canAssign: boolean; selfId?: string }) {
  const { busy, run } = useBusy();
  const [owner, setOwner] = useState(party.owner_user_id ?? "none");
  useEffect(() => { if (open) setOwner(party.owner_user_id ?? "none"); }, [open, party.owner_user_id]);
  const staff = useQuery({ queryKey: ["party-staff-options"], enabled: open, queryFn: () => rpcOrThrow<StaffOption[]>("party_staff_options", {}) });
  const options = canAssign ? (staff.data ?? []) : (staff.data ?? []).filter(s => s.user_id === selfId);
  const submit = () => run(async () => {
    await rpcOrThrow("party_set_owner", { _id: party.id, _owner: owner === "none" ? null : owner, _reason: null });
    toast.success(owner === "none" ? "العميل بقى من غير مسؤول — مهامه في القائمة المشتركة" : "اتحدد المسؤول");
    onOpenChange(false); onDone?.();
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader><DialogTitle>المسؤول عن العميل</DialogTitle><DialogDescription>خانة اختيارية. العميل اللي مالوش مسؤول، مهامه بتروح لقائمة مشتركة لكل السيلز.</DialogDescription></DialogHeader>
        <Select value={owner} onValueChange={setOwner} dir="rtl"><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{canAssign && <SelectItem value="none">بدون مسؤول</SelectItem>}{options.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.name}</SelectItem>)}</SelectContent></Select>
        {staff.data && options.length === 0 && <p className="text-sm text-muted-foreground">مفيش موظفين متاحين للاختيار.</p>}
        <DialogFooter><Button disabled={busy || owner === (party.owner_user_id ?? "none")} onClick={submit}>{busy ? "جارٍ الحفظ…" : "حفظ"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
