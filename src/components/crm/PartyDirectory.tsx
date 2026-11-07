import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, MessageSquarePlus, Plus, Search, Upload, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { recordHref } from "@/lib/adminNavigation";
import { formatDateTime } from "@/lib/format";
import { ACTIVITY_OUTCOME_LABELS } from "@/lib/crm";
import {
  CLOSE_REASON_LABELS, PARTY_STATUS_LABELS, PARTY_STATUS_TABS, rpcOrThrow, sourceLabel,
  type DirectoryPage, type PartyRow, type PartyStatus,
} from "@/lib/partyDirectory";
import { AddPartyDialog, LogContactDialog } from "./PartyDialogs";

export type Segment = "all" | "target" | "interested";
const PAGE = 25;

export function PartyStatusBadge({ status }: { status: PartyStatus }) {
  const variant = status === "tenant" ? "default" : status === "closed" ? "destructive" : status === "archived" ? "outline" : "secondary";
  return <Badge variant={variant} className="whitespace-nowrap">{PARTY_STATUS_LABELS[status]}</Badge>;
}

export function PartyDirectory({ segment }: { segment: Segment }) {
  const auth = useAuth();
  const canWrite = auth.can("opportunities.write", "edit") || auth.can("opportunities.write", "own");
  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState(""), [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);
  const [logFor, setLogFor] = useState<PartyRow | null>(null);
  useEffect(() => { const t = setTimeout(() => { setDebounced(search.trim()); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);

  const status = segment === "all" ? tab : segment;
  const q = useQuery({
    queryKey: ["party-directory", auth.user?.id, status, debounced, page],
    placeholderData: prev => prev,
    queryFn: () => rpcOrThrow<DirectoryPage>("party_directory_page", { _status: status, _search: debounced, _limit: PAGE, _offset: page * PAGE }),
  });
  const counts = q.data?.counts ?? {};
  const total = Object.entries(counts).filter(([k]) => k !== "archived").reduce((s, [, v]) => s + (v ?? 0), 0);

  const convert = async (p: PartyRow) => {
    try {
      await rpcOrThrow("convert_target_to_interested", { _id: p.id, _note: null });
      toast.success(`${p.name_ar} بقى في المهتمين`);
      void q.refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "تعذر التحويل"); }
  };

  const tabs: { key: string; label: string; count?: number }[] = segment === "all" ? [
    { key: "all", label: "الكل", count: total },
    ...PARTY_STATUS_TABS.map(s => ({ key: s, label: PARTY_STATUS_LABELS[s], count: counts[s] })),
    { key: "no_owner", label: "بدون مسؤول", count: q.data?.no_owner },
  ] : [];

  const meta = {
    all: { title: "العملاء", desc: "كل عميل له ملف واحد بكود ثابت، ونوعه بيتحدد تلقائيًا من حالته: مستأجر، حاجز، مهتم، مستهدف، مغلق." },
    target: { title: "المستهدفون", desc: "عملاء لسه ماحصلش معاهم تواصل مثمر. سجّل المحاولة، أو حوّل العميل لمهتم لما يبدي اهتمام." },
    interested: { title: "المهتمون", desc: "عملاء أبدوا اهتمام من أي مصدر (المنصة، تيليجرام، الإضافة اليدوية). تابع معاهم أو احجزلهم وحدة." },
  }[segment];

  return (
    <section className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{meta.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{meta.desc}</p>
          <p className="mt-1 text-xs text-muted-foreground">النطاق: كل المشروع · آخر تحديث: {formatDateTime(q.data?.as_of)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && <Button onClick={() => setAdding(true)}><Plus className="ml-1 h-4 w-4" />{segment === "interested" ? "إضافة مهتم" : segment === "target" ? "إضافة مستهدف" : "إضافة عميل"}</Button>}
          {canWrite && segment !== "interested" && <Button asChild variant="outline"><Link to="/admin/opportunities/import"><Upload className="ml-1 h-4 w-4" />استيراد ملف</Link></Button>}
          {auth.isAdmin && segment !== "all" && <Button asChild variant="ghost"><Link to={segment === "target" ? "/admin/leads/legacy" : "/admin/interested/legacy"}>القائمة القديمة</Link></Button>}
        </div>
      </div>

      {tabs.length > 0 && (
        <nav className="flex gap-1 overflow-x-auto border-b border-border pb-2" aria-label="أنواع العملاء">
          {tabs.map(t => (
            <Button key={t.key} size="sm" variant={tab === t.key ? "default" : "ghost"} className="shrink-0" onClick={() => { setTab(t.key); setPage(0); }}>
              {t.label}{t.count != null && <span className="mr-1.5 tabular-nums opacity-70">{t.count}</span>}
            </Button>
          ))}
        </nav>
      )}

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pr-9" placeholder="ابحث بالاسم أو كود العميل أو الجوال أو الهوية" value={search} onChange={e => setSearch(e.target.value)} aria-label="بحث" />
      </div>

      {q.isError && <p role="alert" className="text-destructive">{(q.error as Error).message}</p>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العميل</TableHead>
              <TableHead>الجوال</TableHead>
              {segment === "all" && <TableHead>النوع</TableHead>}
              <TableHead>المسؤول</TableHead>
              <TableHead>آخر تواصل</TableHead>
              <TableHead>{segment === "all" ? "المصدر" : "الخطوة الجاية"}</TableHead>
              <TableHead className="text-left">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data?.rows.map(p => (
              <TableRow key={p.id}>
                <TableCell className="min-w-[12rem]">
                  <Link to={recordHref("parties", p.id)} className="font-semibold text-primary hover:underline">{p.name_ar}</Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span dir="ltr">{p.tenant_code}</span>
                    {p.do_not_contact && <Badge variant="destructive" className="gap-1 px-1.5 py-0 text-[10px]"><Ban className="h-3 w-3" />لا يُتواصل معه</Badge>}
                    {p.status === "closed" && p.close_reason && <span>· {CLOSE_REASON_LABELS[p.close_reason] ?? p.close_reason}</span>}
                    {p.status === "archived" && p.duplicate_of_code && <span>· مكرر من <span dir="ltr">{p.duplicate_of_code}</span></span>}
                  </div>
                </TableCell>
                <TableCell dir="ltr" className="whitespace-nowrap text-right tabular-nums">{p.contact_visible ? (p.phone ?? "—") : "مخفي"}</TableCell>
                {segment === "all" && <TableCell><PartyStatusBadge status={p.status} /></TableCell>}
                <TableCell className="whitespace-nowrap">{p.owner_name ?? <span className="text-muted-foreground">بدون</span>}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{formatDateTime(p.last_contact_at)}</TableCell>
                <TableCell className="min-w-[10rem] text-sm">
                  {segment === "all" ? sourceLabel(p.source)
                    : p.open_opportunity?.next_action ? <>{p.open_opportunity.next_action}<div className="text-xs text-muted-foreground tabular-nums">{formatDateTime(p.open_opportunity.next_action_at)}</div></>
                    : p.open_opportunity?.no_answer_attempts ? <span className="text-muted-foreground">{ACTIVITY_OUTCOME_LABELS.no_answer}: {p.open_opportunity.no_answer_attempts} من 10</span>
                    : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
                    {canWrite && segment !== "all" && <Button size="sm" variant="outline" onClick={() => setLogFor(p)}><MessageSquarePlus className="ml-1 h-4 w-4" />{segment === "target" ? "تسجيل محاولة" : "تسجيل تواصل"}</Button>}
                    {canWrite && segment === "target" && <Button size="sm" variant="secondary" onClick={() => void convert(p)}><UserCheck className="ml-1 h-4 w-4" />تحويل لمهتم</Button>}
                    {segment === "interested" && <Button size="sm" asChild><Link to={`/booking?party=${p.id}`}>حجز وحدة</Link></Button>}
                    {segment === "all" && <Button size="sm" variant="ghost" asChild><Link to={recordHref("parties", p.id)}>فتح الملف</Link></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {q.data && q.data.rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">{debounced ? "مفيش نتائج للبحث ده" : "لا يوجد عملاء في القسم ده"}</TableCell></TableRow>
            )}
            {q.isPending && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">جارٍ التحميل…</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground tabular-nums">{q.data ? `${q.data.count} عميل · صفحة ${page + 1} من ${Math.max(1, Math.ceil(q.data.count / PAGE))}` : ""}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!page} onClick={() => setPage(p => p - 1)}>السابق</Button>
          <Button variant="outline" size="sm" disabled={(page + 1) * PAGE >= (q.data?.count ?? 0)} onClick={() => setPage(p => p + 1)}>التالي</Button>
        </div>
      </div>

      <AddPartyDialog open={adding} onOpenChange={setAdding} interested={segment === "interested"} onDone={() => void q.refetch()}
        title={segment === "interested" ? "إضافة مهتم" : segment === "target" ? "إضافة مستهدف" : undefined} />
      {logFor && <LogContactDialog open={!!logFor} onOpenChange={o => !o && setLogFor(null)} partyId={logFor.id} partyName={logFor.name_ar}
        defaultOutcome={segment === "target" ? "no_answer" : "answered"} onDone={() => void q.refetch()} />}
    </section>
  );
}
