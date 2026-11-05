import { Header } from "@/components/Header";
import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Layers, Loader2, Pencil, Plus, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RISK_LABELS } from "@/lib/bookingActivities";
import { MIN_REASON_LENGTH, isValidReason } from "@/lib/safetyRules";

type Activity = {
  id: string; code: string; name_ar: string; short_name: string | null; description: string | null; marker: string | null;
  unit_type: string; risk_class: string | null; notes: string | null; is_active: boolean; sort_order: number;
};
type BuildingRow = { id: string; number: number; type: string; phase: number | null; is_published: boolean; activity_id: string | null; booking_enabled: boolean };

const UNIT_TYPES: Record<string, string> = { workshop: "ورشة", warehouse: "مستودع", shop: "محل", showroom: "معرض", restaurant: "مطعم", service: "خدمي" };
const EMPTY: Omit<Activity, "id"> = { code: "", name_ar: "", short_name: "", description: "", marker: "", unit_type: "workshop", risk_class: null, notes: "", is_active: true, sort_order: 100 };

export default function AdminActivities() {
  const { isAdmin, isManager, loading } = useAuth();
  const [acts, setActs] = useState<Activity[]>([]);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [links, setLinks] = useState<{ building_id: string; activity_id: string }[]>([]);
  const [busy, setBusy] = useState(true);
  const [asOf, setAsOf] = useState<Date | null>(null);
  const [edit, setEdit] = useState<(Omit<Activity, "id"> & { id?: string }) | null>(null);
  const [bEdit, setBEdit] = useState<{ b: BuildingRow; primary: string; extras: string[]; phase: string; published: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setBusy(true);
    const [a, b, l] = await Promise.all([
      supabase.from("activities").select("*").order("sort_order"),
      supabase.from("buildings").select("id, number, type, phase, is_published, activity_id, booking_enabled").order("number"),
      supabase.from("building_activities").select("building_id, activity_id"),
    ]);
    if (a.error || b.error || l.error) toast.error((a.error || b.error || l.error)!.message);
    setActs((a.data ?? []) as Activity[]);
    setBuildings((b.data ?? []) as BuildingRow[]);
    setLinks(l.data ?? []);
    setAsOf(new Date());
    setBusy(false);
  };
  useEffect(() => { if (isAdmin || isManager) load(); }, [isAdmin, isManager]);

  const byId = useMemo(() => new Map(acts.map((a) => [a.id, a])), [acts]);
  const buildingsOf = (activityId: string) =>
    buildings.filter((b) => b.activity_id === activityId || links.some((l) => l.building_id === b.id && l.activity_id === activityId)).map((b) => b.number);

  if (loading) return null;
  if (!isAdmin && !isManager) return <Navigate to="/" replace />;

  const saveActivity = async () => {
    if (!edit) return;
    if (!isValidReason(reason)) return toast.error(`اكتب سبب التعديل (${MIN_REASON_LENGTH} أحرف على الأقل)`);
    setSaving(true);
    const { error } = await supabase.rpc("admin_upsert_activity", {
      _id: edit.id ?? null, _code: edit.code, _name_ar: edit.name_ar, _short_name: edit.short_name ?? "", _description: edit.description ?? "",
      _marker: edit.marker ?? "", _unit_type: edit.unit_type, _risk_class: edit.risk_class ?? "", _notes: edit.notes ?? "",
      _is_active: edit.is_active, _sort_order: edit.sort_order, _reason: reason.trim(),
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("تم حفظ النشاط");
    setEdit(null); setReason(""); load();
  };

  const saveBuilding = async () => {
    if (!bEdit) return;
    if (!isValidReason(reason)) return toast.error(`اكتب سبب التعديل (${MIN_REASON_LENGTH} أحرف على الأقل)`);
    setSaving(true);
    const { error } = await supabase.rpc("admin_set_building_registry", {
      _building_number: bEdit.b.number,
      _primary_code: bEdit.primary === "none" ? "" : bEdit.primary,
      _extra_codes: bEdit.extras,
      _phase: bEdit.phase ? Number(bEdit.phase) : null,
      _is_published: bEdit.published,
      _reason: reason.trim(),
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`تم تحديث المبنى ${bEdit.b.number}`);
    setBEdit(null); setReason(""); load();
  };

  return (
    <><Header/><main className="container-tight space-y-6 py-8" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Layers className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">الإعدادات — الأنشطة والمباني</h1>
            <p className="text-xs text-muted-foreground">النطاق: المشروع كامل · محدث {asOf ? asOf.toLocaleString("ar-SA") : "—"}</p>
          </div>
        </div>
        {isAdmin && <Button onClick={() => { setEdit({ ...EMPTY }); setReason(""); }}><Plus className="h-4 w-4" />نشاط جديد</Button>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الأنشطة</CardTitle>
          <CardDescription>صفحة الحجز تعرض الأنشطة المفعّلة بس، بنفس الأسماء والأوصاف والمباني المسجّلة هنا.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {busy ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>الكود</TableHead><TableHead>الاسم</TableHead><TableHead>نوع الوحدة</TableHead><TableHead>الخطورة</TableHead>
                <TableHead>المباني</TableHead><TableHead>الحالة</TableHead><TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {acts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs" dir="ltr">{a.code}</TableCell>
                    <TableCell className="font-medium">{a.name_ar}</TableCell>
                    <TableCell>{UNIT_TYPES[a.unit_type] ?? a.unit_type}</TableCell>
                    <TableCell>{a.risk_class ? RISK_LABELS[a.risk_class] : "—"}</TableCell>
                    <TableCell className="num text-xs">{buildingsOf(a.id).join("، ") || "—"}</TableCell>
                    <TableCell>{a.is_active ? <Badge>مفعّل</Badge> : <Badge variant="secondary">موقوف</Badge>}</TableCell>
                    <TableCell>{isAdmin && <Button size="sm" variant="ghost" onClick={() => { setEdit({ ...a }); setReason(""); }}><Pencil className="h-4 w-4" /></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />المباني</CardTitle>
          <CardDescription>النشاط الأساسي والأنشطة الإضافية والمرحلة وحالة النشر لكل مبنى. المبنى غير المنشور ما بيظهرش في الموقع.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>المبنى</TableHead><TableHead>النشاط الأساسي</TableHead><TableHead>أنشطة إضافية</TableHead>
              <TableHead>المرحلة</TableHead><TableHead>النشر</TableHead><TableHead>الحجز</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {buildings.map((b) => {
                const extras = links.filter((l) => l.building_id === b.id && l.activity_id !== b.activity_id).map((l) => byId.get(l.activity_id)?.short_name || byId.get(l.activity_id)?.name_ar);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="num font-bold">{b.number}</TableCell>
                    <TableCell>{b.activity_id ? byId.get(b.activity_id)?.name_ar : "—"}</TableCell>
                    <TableCell className="text-xs">{extras.join("، ") || "—"}</TableCell>
                    <TableCell className="num">{b.phase ?? "—"}</TableCell>
                    <TableCell>{b.is_published ? <Badge>منشور</Badge> : <Badge variant="secondary">مسودة</Badge>}</TableCell>
                    <TableCell>{b.booking_enabled ? "مفتوح" : "مقفول"}</TableCell>
                    <TableCell>{isAdmin && (
                      <Button size="sm" variant="ghost" onClick={() => {
                        setReason("");
                        setBEdit({ b, primary: b.activity_id ? byId.get(b.activity_id)?.code ?? "none" : "none",
                          extras: links.filter((l) => l.building_id === b.id && l.activity_id !== b.activity_id).map((l) => byId.get(l.activity_id)?.code).filter(Boolean) as string[],
                          phase: b.phase?.toString() ?? "", published: b.is_published });
                      }}><Pencil className="h-4 w-4" /></Button>
                    )}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? "تعديل نشاط" : "نشاط جديد"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>الكود (إنجليزي)</Label><Input dir="ltr" value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></div>
                <div><Label>الترتيب</Label><Input type="number" value={edit.sort_order} onChange={(e) => setEdit({ ...edit, sort_order: Number(e.target.value) })} /></div>
              </div>
              <div><Label>الاسم</Label><Input value={edit.name_ar} onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} /></div>
              <div><Label>الاسم المختصر</Label><Input value={edit.short_name ?? ""} onChange={(e) => setEdit({ ...edit, short_name: e.target.value })} /></div>
              <div><Label>الوصف (يظهر للعملاء)</Label><Textarea rows={3} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>نوع الوحدة</Label>
                  <Select value={edit.unit_type} onValueChange={(v) => setEdit({ ...edit, unit_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(UNIT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>درجة الخطورة</Label>
                  <Select value={edit.risk_class ?? "none"} onValueChange={(v) => setEdit({ ...edit, risk_class: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">غير محدد</SelectItem>{Object.entries(RISK_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>علامة التمييز في النشاط المسجل للوحدة</Label><Input value={edit.marker ?? ""} onChange={(e) => setEdit({ ...edit, marker: e.target.value })} /></div>
              <div><Label>ملاحظات داخلية</Label><Input value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} />مفعّل ويظهر في الموقع</label>
              <div><Label>سبب التعديل</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={saveActivity} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!bEdit} onOpenChange={(o) => !o && setBEdit(null)}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader><DialogTitle>المبنى {bEdit?.b.number}</DialogTitle></DialogHeader>
          {bEdit && (
            <div className="grid gap-3">
              <div><Label>النشاط الأساسي</Label>
                <Select value={bEdit.primary} onValueChange={(v) => setBEdit({ ...bEdit, primary: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">بدون</SelectItem>{acts.map((a) => <SelectItem key={a.id} value={a.code}>{a.name_ar}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>أنشطة إضافية على نفس المبنى</Label>
                <div className="mt-2 grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-md border p-2">
                  {acts.filter((a) => a.code !== bEdit.primary).map((a) => (
                    <label key={a.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={bEdit.extras.includes(a.code)} onCheckedChange={(c) => setBEdit({ ...bEdit, extras: c ? [...bEdit.extras, a.code] : bEdit.extras.filter((x) => x !== a.code) })} />
                      {a.short_name || a.name_ar}
                    </label>
                  ))}
                </div>
              </div>
              <div><Label>المرحلة</Label><Input type="number" value={bEdit.phase} onChange={(e) => setBEdit({ ...bEdit, phase: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={bEdit.published} onCheckedChange={(v) => setBEdit({ ...bEdit, published: v })} />منشور في الموقع</label>
              <div><Label>سبب التعديل</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={saveBuilding} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main></>
  );
}
