import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { FileUp, Loader2, Upload, Eye, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IMPORT_FIELDS, canSelect, defaultApprovedFields, guessMapping, mapRows, type ImportField, type ImportRow, type PreviewRow } from "@/lib/unitImport";
import { MIN_REASON_LENGTH, isValidReason } from "@/lib/safetyRules";
import { exportRowsToExcel } from "@/lib/exportData";

const FIELD_LABELS: Record<string, string> = { unit_type: "النوع", activity_id: "النشاط", area_m2: "المساحة", price: "السعر (غير شامل الضريبة)" };
const KIND: Record<PreviewRow["kind"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "جديدة", variant: "default" },
  changed: { label: "متغيّرة", variant: "secondary" },
  unchanged: { label: "بدون تغيير", variant: "outline" },
  conflict: { label: "متعارضة", variant: "destructive" },
};
const PAGE = 50;

export default function AdminUnitImport() {
  const { isAdmin, isManager, loading } = useAuth();
  const [fileName, setFileName] = useState("");
  const [raw, setRaw] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, string>>>({});
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [selected, setSelected] = useState<Record<number, string[] | true>>({});
  const [kindFilter, setKindFilter] = useState("all");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Draft / hidden / test units
  const [drafts, setDrafts] = useState<any[]>([]);
  const [draftTotal, setDraftTotal] = useState(0);
  const [draftPage, setDraftPage] = useState(0);
  const [draftReason, setDraftReason] = useState("");

  const loadDrafts = async () => {
    const { data, count, error } = await supabase.from("units")
      .select("id, building_number, unit_number, unit_type, area_m2, activity, publish_state, is_test", { count: "exact" })
      .or("publish_state.neq.published,is_test.eq.true")
      .order("building_number").order("unit_number")
      .range(draftPage * PAGE, draftPage * PAGE + PAGE - 1);
    if (error) return toast.error(error.message);
    setDrafts(data ?? []); setDraftTotal(count ?? 0);
  };
  useEffect(() => { if (isAdmin || isManager) loadDrafts(); }, [isAdmin, isManager, draftPage]);

  const visible = useMemo(() => (preview ?? []).filter((p) => kindFilter === "all" || p.kind === kindFilter), [preview, kindFilter]);
  const counts = useMemo(() => {
    const c = { new: 0, changed: 0, unchanged: 0, conflict: 0 };
    for (const p of preview ?? []) c[p.kind]++;
    return c;
  }, [preview]);

  if (loading) return null;
  if (!isAdmin && !isManager) return <Navigate to="/" replace />;

  const onFile = async (f: File) => {
    const wb = XLSX.read(await f.arrayBuffer());
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    if (!data.length) return toast.error("الملف فاضي");
    if (data.length > 5000) return toast.error("الحد الأقصى 5000 صف في الملف الواحد");
    const hs = Object.keys(data[0]);
    setFileName(f.name); setRaw(data); setHeaders(hs); setMapping(guessMapping(hs)); setPreview(null); setSelected({});
  };

  const runPreview = async () => {
    const missing = IMPORT_FIELDS.filter((f) => f.required && !mapping[f.key]);
    if (missing.length) return toast.error(`حدد عمود: ${missing.map((m) => m.label).join("، ")}`);
    const mapped = mapRows(raw, mapping);
    setBusy(true);
    const { data, error } = await supabase.rpc("unit_import_preview", { _rows: mapped as any });
    setBusy(false);
    if (error) return toast.error(error.message);
    const p = data as unknown as PreviewRow[];
    setRows(mapped); setPreview(p);
    const sel: Record<number, string[] | true> = {};
    p.forEach((x) => { if (x.kind === "new") sel[x.row] = true; else if (x.kind === "changed") sel[x.row] = defaultApprovedFields(x); });
    setSelected(sel);
  };

  const apply = async () => {
    if (!isValidReason(reason)) return toast.error(`اكتب سبب الاستيراد (${MIN_REASON_LENGTH} أحرف على الأقل)`);
    const payload = rows
      .filter((r) => selected[r.row] && (selected[r.row] === true || (selected[r.row] as string[]).length))
      .map((r) => ({ ...r, approved_fields: selected[r.row] === true ? [] : selected[r.row] }));
    if (!payload.length) return toast.error("مفيش صفوف معلّم عليها");
    setBusy(true);
    const { data, error } = await supabase.rpc("unit_import_apply", { _rows: payload as any, _file_name: fileName, _reason: reason.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    const d = data as any;
    toast.success(`تم: ${d.inserted} وحدة جديدة (مسودة) و${d.updated} وحدة اتعدلت`);
    setPreview(null); setRaw([]); setSelected({}); setReason(""); loadDrafts();
  };

  const toggleField = (p: PreviewRow, field: string, on: boolean) => {
    const cur = (selected[p.row] as string[] | undefined) ?? [];
    setSelected({ ...selected, [p.row]: on ? [...cur, field] : cur.filter((f) => f !== field) });
  };

  const publish = async (id: string, state: string) => {
    if (!isValidReason(draftReason)) return toast.error(`اكتب السبب أولًا (${MIN_REASON_LENGTH} أحرف على الأقل)`);
    const { error } = await supabase.rpc("publish_unit", { _unit_id: id, _state: state, _reason: draftReason.trim() });
    if (error) return toast.error(error.message);
    toast.success("تم"); loadDrafts();
  };
  const setTest = async (id: string, on: boolean) => {
    if (!isValidReason(draftReason)) return toast.error(`اكتب السبب أولًا (${MIN_REASON_LENGTH} أحرف على الأقل)`);
    const { error } = await supabase.rpc("admin_set_unit_test", { _unit_id: id, _is_test: on, _reason: draftReason.trim() });
    if (error) return toast.error(error.message);
    toast.success("تم"); loadDrafts();
  };

  return (
    <main className="container-tight space-y-6 py-8" dir="rtl">
      <div className="flex items-center gap-3">
        <FileUp className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">الإعدادات — استيراد الوحدات</h1>
          <p className="text-xs text-muted-foreground">النطاق: المشروع كامل. مفيش أي تعديل بيحصل غير بعد المعاينة وموافقتك على كل صف.</p>
        </div>
      </div>

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import">استيراد ملف</TabsTrigger>
          <TabsTrigger value="drafts">مسودات ووحدات مخفية (<span className="num">{draftTotal}</span>)</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. ارفع الملف</CardTitle>
              <CardDescription>CSV أو XLSX، أول ورقة بس. الصف الأول لازم يكون أسماء الأعمدة.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input type="file" accept=".csv,.xlsx,.xls" disabled={!isAdmin} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              {headers.length > 0 && (
                <>
                  <p className="text-sm">الملف: <b>{fileName}</b> · <span className="num">{raw.length}</span> صف</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {IMPORT_FIELDS.map((f) => (
                      <div key={f.key}>
                        <Label>{f.label}{f.required && <span className="mr-1 text-destructive">*</span>}</Label>
                        <Select value={mapping[f.key] ?? "__none"} onValueChange={(v) => setMapping({ ...mapping, [f.key]: v === "__none" ? undefined : v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="__none">— بدون —</SelectItem>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  <Button onClick={runPreview} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}معاينة تجريبية</Button>
                </>
              )}
            </CardContent>
          </Card>

          {preview && (
            <Card>
              <CardHeader>
                <CardTitle>2. المعاينة</CardTitle>
                <CardDescription>
                  جديدة <span className="num">{counts.new}</span> · متغيّرة <span className="num">{counts.changed}</span> · بدون تغيير <span className="num">{counts.unchanged}</span> · متعارضة <span className="num">{counts.conflict}</span>.
                  الصفوف المتعارضة مقفولة لحد ما تصلحها في الملف. تغييرات السعر مش متعلّم عليها افتراضيًا.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={kindFilter} onValueChange={setKindFilter}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">الكل</SelectItem>{Object.entries(KIND).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => exportRowsToExcel(preview.map((p) => ({ "الصف": p.row, "النتيجة": KIND[p.kind].label, "المبنى": p.building_number ?? "", "الوحدة": p.unit_number ?? "", "التغييرات": p.changes.map((c) => `${FIELD_LABELS[c.field] ?? c.field}: ${c.old ?? "—"} ← ${c.new}`).join(" | "), "التعارضات": p.conflicts.join(" | ") })), "unit_import_preview", "المعاينة")}>تصدير المعاينة</Button>
                </div>
                <div className="max-h-[60vh] overflow-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead className="w-10" /><TableHead>الصف</TableHead><TableHead>النتيجة</TableHead><TableHead>المبنى / الوحدة</TableHead><TableHead>التفاصيل</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {visible.map((p) => (
                        <TableRow key={p.row}>
                          <TableCell>
                            {p.kind === "new" && <Checkbox disabled={!isAdmin} checked={!!selected[p.row]} onCheckedChange={(c) => setSelected({ ...selected, [p.row]: c ? true : (undefined as any) })} />}
                          </TableCell>
                          <TableCell className="num">{p.row}</TableCell>
                          <TableCell><Badge variant={KIND[p.kind].variant}>{KIND[p.kind].label}</Badge></TableCell>
                          <TableCell className="num">م{p.building_number ?? "؟"} · و{p.unit_number ?? "؟"}</TableCell>
                          <TableCell className="text-xs">
                            {p.kind === "conflict" && <ul className="list-inside list-disc text-destructive">{p.conflicts.map((c) => <li key={c}>{c}</li>)}</ul>}
                            {p.kind === "new" && <span>{p.activity_name ?? "بدون نشاط"} · <span className="num">{p.area_m2}</span> م² · تدخل كمسودة</span>}
                            {p.kind === "changed" && (
                              <div className="space-y-1">
                                {p.changes.map((c) => (
                                  <label key={c.field} className="flex items-center gap-2">
                                    {canSelect(p) && <Checkbox disabled={!isAdmin} checked={((selected[p.row] as string[]) ?? []).includes(c.field)} onCheckedChange={(on) => toggleField(p, c.field, !!on)} />}
                                    <b>{FIELD_LABELS[c.field] ?? c.field}:</b> <span className="text-muted-foreground line-through">{String(c.old ?? "—")}</span> ← <span>{String(c.new)}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {isAdmin && (
                  <div className="flex flex-wrap items-end gap-3 border-t pt-4">
                    <div className="flex-1"><Label>سبب الاستيراد</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: تحديث مساحات المستودعات من شيت المالك" /></div>
                    <Button onClick={apply} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}تطبيق الصفوف المعلّم عليها</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="drafts">
          <Card>
            <CardHeader>
              <CardTitle>المسودات والوحدات المخفية والتجريبية</CardTitle>
              <CardDescription>النشر محتاج مبنى ونشاط ونوع ومساحة. الوحدات التجريبية ما بتظهرش في الموقع ولا بتدخل في أي أرقام.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAdmin && <div className="max-w-md"><Label>السبب (مطلوب لأي إجراء)</Label><Input value={draftReason} onChange={(e) => setDraftReason(e.target.value)} /></div>}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>المبنى / الوحدة</TableHead><TableHead>النوع</TableHead><TableHead>النشاط</TableHead><TableHead>المساحة م²</TableHead><TableHead>النشر</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {drafts.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="num">م{u.building_number} · و{u.unit_number} {u.is_test && <Badge variant="outline">تجريبية</Badge>}</TableCell>
                        <TableCell>{u.unit_type ?? "—"}</TableCell>
                        <TableCell>{u.activity ?? "—"}</TableCell>
                        <TableCell className="num">{u.area_m2 ?? "—"}</TableCell>
                        <TableCell>{u.publish_state === "draft" ? "مسودة" : u.publish_state === "hidden" ? "مخفية" : "منشورة"}</TableCell>
                        <TableCell className="space-x-1 space-x-reverse whitespace-nowrap">
                          {isAdmin && !u.is_test && u.publish_state !== "published" && <Button size="sm" onClick={() => publish(u.id, "published")}><CheckCircle2 className="h-4 w-4" />نشر</Button>}
                          {isAdmin && u.publish_state === "draft" && <Button size="sm" variant="outline" onClick={() => publish(u.id, "hidden")}>إخفاء</Button>}
                          {isAdmin && <Button size="sm" variant="ghost" onClick={() => setTest(u.id, !u.is_test)}>{u.is_test ? "إلغاء التجريبية" : "تجريبية"}</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!drafts.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">مفيش مسودات</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
              {draftTotal > PAGE && (
                <div className="flex items-center justify-center gap-3 text-sm">
                  <Button size="sm" variant="outline" disabled={draftPage === 0} onClick={() => setDraftPage(draftPage - 1)}>السابق</Button>
                  <span className="num">{draftPage + 1} / {Math.ceil(draftTotal / PAGE)}</span>
                  <Button size="sm" variant="outline" disabled={(draftPage + 1) * PAGE >= draftTotal} onClick={() => setDraftPage(draftPage + 1)}>التالي</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  );
}
