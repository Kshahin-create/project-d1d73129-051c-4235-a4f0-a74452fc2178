import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/format";
import { CLOSE_REASON_LABELS, PARTY_STATUS_LABELS, rpcOrThrow, type PartyStatus } from "@/lib/partyDirectory";

type Entry = { id: string; action: string; created_at: string; actor_name: string | null; actor_email: string | null; context: { reason?: string } | null; before_data: Record<string, unknown> | null; after_data: Record<string, unknown> | null };

const ACTION_LABELS: Record<string, string> = {
  PARTY_CREATE: "إنشاء الملف", PARTY_UPDATE: "تعديل البيانات", PARTY_CLOSE: "قفل العميل", PARTY_CLOSE_FROM_OPPORTUNITY: "قفل مع قفل الفرصة",
  PARTY_AUTO_CLOSE_NO_ANSWER: "قفل تلقائي بعد 10 محاولات بدون رد", PARTY_REOPEN: "إعادة فتح بفرصة جديدة", PARTY_CONVERT_INTERESTED: "تحويل لمهتم",
  PARTY_MARK_INTERESTED: "تسجيل اهتمام", PARTY_DO_NOT_CONTACT_ON: "لا يُتواصل معه", PARTY_DO_NOT_CONTACT_OFF: "إلغاء «لا يُتواصل معه»",
  PARTY_MARK_DUPLICATE: "تعليم كمكرر", PARTY_RESTORE_DUPLICATE: "إلغاء علامة المكرر", PARTY_MERGE: "دمج في ملف آخر", PARTY_MERGE_RECEIVED: "استقبال ملف مدموج",
  PARTY_UNMERGE: "تراجع عن الدمج", PARTY_UNMERGE_RETURNED: "إرجاع بيانات بعد التراجع عن الدمج", PARTY_SET_OWNER: "تغيير المسؤول", PARTY_IMPORT_APPLY: "استيراد من ملف",
  INSERT: "إضافة", UPDATE: "تعديل",
};
const FIELD_LABELS: Record<string, string> = {
  name_ar: "الاسم", name_en: "الاسم بالإنجليزي", phone: "الجوال", email: "البريد", id_type: "نوع الهوية", id_number: "رقم الهوية", city: "المدينة",
  party_type: "نوع العميل", owner_user_id: "المسؤول", do_not_contact: "لا يُتواصل معه", close_reason: "سبب القفل", closed_at: "تاريخ القفل",
  duplicate_of_id: "مكرر من", merged_into_id: "اتدمج في", archived_at: "الأرشفة", interested_at: "تاريخ الاهتمام", status: "النوع",
};
const HIDDEN = new Set(["updated_at", "phone_key", "id", "tenant_code", "created_at", "do_not_contact_at", "do_not_contact_by", "closed_by", "archived_by", "reopened_at"]);

function show(key: string, v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "نعم" : "لا";
  if (key === "close_reason") return CLOSE_REASON_LABELS[v as keyof typeof CLOSE_REASON_LABELS] ?? String(v);
  if (key === "status") return PARTY_STATUS_LABELS[v as PartyStatus] ?? String(v);
  if (key === "party_type") return v === "company" ? "شركة / مؤسسة" : "فرد";
  if (key.endsWith("_at")) return formatDateTime(String(v));
  if (key.endsWith("_id") || key === "owner_user_id") return "مُحدَّد";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

function changes(e: Entry) {
  const before = e.before_data ?? {}, after = e.after_data ?? {};
  return Object.keys({ ...before, ...after })
    .filter(k => !HIDDEN.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k]) && FIELD_LABELS[k])
    .map(k => ({ k, from: show(k, before[k]), to: show(k, after[k]) }));
}

export function PartyHistory({ partyId }: { partyId: string }) {
  const auth = useAuth();
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ["party-history", partyId, auth.user?.id, page],
    queryFn: () => rpcOrThrow<{ rows: Entry[]; count: number }>("party_history", { _id: partyId, _limit: 25, _offset: page * 25 }),
  });
  if (q.isError) return <p role="alert" className="text-destructive">{(q.error as Error).message}</p>;
  return (
    <section className="space-y-3" dir="rtl">
      <h2 className="text-lg font-bold">سجل العميل</h2>
      <ol className="divide-y divide-border">
        {q.data?.rows.map(e => {
          const diff = changes(e);
          return (
            <li key={e.id} className="space-y-1 py-3 text-sm">
              <p className="font-semibold">{ACTION_LABELS[e.action] ?? "إجراء مسجل"}</p>
              <p className="text-xs text-muted-foreground"><span className="tabular-nums">{formatDateTime(e.created_at)}</span> · {e.actor_name ?? e.actor_email ?? "النظام"}</p>
              {diff.length > 0 && <ul className="space-y-0.5">{diff.map(d => <li key={d.k}><span className="text-muted-foreground">{FIELD_LABELS[d.k]}:</span> {d.from} ← <span className="font-medium">{d.to}</span></li>)}</ul>}
              {e.context?.reason && <p className="text-muted-foreground">السبب: {e.context.reason}</p>}
            </li>
          );
        })}
      </ol>
      {q.data?.count === 0 && <p className="text-muted-foreground">لا يوجد سجل لسه</p>}
      {q.isPending && <p className="text-muted-foreground">جارٍ التحميل…</p>}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" disabled={!page} onClick={() => setPage(p => p - 1)}>السابق</Button>
        <span className="text-sm text-muted-foreground tabular-nums">{q.data?.count ?? 0} إجراء</span>
        <Button variant="outline" size="sm" disabled={(page + 1) * 25 >= (q.data?.count ?? 0)} onClick={() => setPage(p => p + 1)}>التالي</Button>
      </div>
    </section>
  );
}
