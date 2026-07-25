import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Trash2, Download, Eye, Pencil, RefreshCcw, Paperclip, X, Upload } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";

const BUCKET = "unit-collection-proofs";

export type UnitCollection = {
  id: string;
  unit_id: string;
  tenant_account_id: string;
  amount: number;
  proof_path: string | null;
  proof_name: string | null;
  proof_mime: string | null;
  proof_size: number | null;
  created_by: string | null;
  created_at: string;
  creator_name?: string | null;
};

const fmt = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US").format(Math.round(Number(n ?? 0)));
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short" }) : "—";

export function UnitCollectionsPanel({
  unitId,
  unitPrice,
  tenantAccountId,
  tenantName,
  canEdit,
  onChanged,
}: {
  unitId: string;
  unitPrice: number;
  tenantAccountId: string | null;
  tenantName: string | null;
  canEdit: boolean;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<UnitCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDel, setConfirmDel] = useState<UnitCollection | null>(null);
  const [editing, setEditing] = useState<UnitCollection | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("unit_collections" as any)
      .select("*")
      .eq("unit_id", unitId)
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    // resolve creator names
    const list = ((data as any) ?? []) as UnitCollection[];
    const ids = Array.from(new Set(list.map((r) => r.created_by).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, display_name, email").in("user_id", ids);
      const map = new Map<string, string>();
      (profs ?? []).forEach((p: any) => map.set(p.user_id, p.display_name || p.email || ""));
      list.forEach((r) => { if (r.created_by) r.creator_name = map.get(r.created_by) ?? null; });
    }
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [unitId]);

  const totalPaid = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const remaining = Number(unitPrice || 0) - totalPaid;
  const pct = unitPrice > 0 ? Math.min(100, Math.round((totalPaid / unitPrice) * 100)) : 0;
  const overpaid = remaining < 0;

  const openProof = async (r: UnitCollection) => {
    if (!r.proof_path) return;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(r.proof_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const downloadProof = async (r: UnitCollection) => {
    if (!r.proof_path) return;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(r.proof_path, 300, { download: r.proof_name ?? undefined });
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    if (confirmDel.proof_path) {
      await supabase.storage.from(BUCKET).remove([confirmDel.proof_path]);
    }
    const { error } = await supabase.from("unit_collections" as any).delete().eq("id", confirmDel.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حذف الدفعة");
    setConfirmDel(null);
    load();
    onChanged?.();
  };

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="rounded-xl border bg-gradient-to-b from-primary/5 to-card p-4">
        <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <KV label="قيمة الوحدة" value={`${fmt(unitPrice)} ر.س`} />
          <KV label="إجمالي المدفوع" value={`${fmt(totalPaid)} ر.س`} tone="emerald" />
          <KV label="المتبقي" value={`${fmt(remaining)} ر.س`} tone={overpaid ? "amber" : "rose"} />
          <KV label="عدد الدفعات" value={String(rows.length)} />
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] font-medium">
            <span className="text-muted-foreground">نسبة التحصيل</span>
            <span className="num font-bold">{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className={cn("h-full rounded-full transition-all", overpaid ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
          </div>
          {overpaid && (
            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800">
              تم تحصيل مبلغ زائد عن قيمة الوحدة.
            </div>
          )}
        </div>
      </div>

      {/* Add button */}
      {canEdit && (
        !tenantAccountId ? (
          <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-3 text-xs text-amber-800">
            لا يمكن تسجيل دفعة لأن الوحدة غير مرتبطة بمستأجر حالي.
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">{tenantName && <>المستأجر الحالي: <b className="text-foreground">{tenantName}</b></>}</div>
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="ml-1 h-3.5 w-3.5" /> إضافة دفعة
            </Button>
          </div>
        )
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">لا توجد تحصيلات مسجّلة على هذه الوحدة</div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-xs">
            <thead className="bg-secondary/50 text-[11px]">
              <tr>
                <th className="p-2 text-right">#</th>
                <th className="p-2 text-right">المبلغ</th>
                <th className="p-2 text-right">إثبات الدفع</th>
                <th className="p-2 text-right">التاريخ</th>
                <th className="p-2 text-right">أضافها</th>
                {canEdit && <th className="p-2 text-right">إجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 num">{rows.length - idx}</td>
                  <td className="p-2 font-bold num">{fmt(r.amount)} ر.س</td>
                  <td className="p-2">
                    {r.proof_path ? (
                      <div className="flex items-center gap-1.5">
                        <Paperclip className="h-3 w-3 text-primary" />
                        <span className="truncate max-w-[160px]" title={r.proof_name ?? ""}>{r.proof_name}</span>
                      </div>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-2 text-muted-foreground">{fmtDate(r.created_at)}</td>
                  <td className="p-2 text-muted-foreground">{r.creator_name || "—"}</td>
                  {canEdit && (
                    <td className="p-2">
                      <div className="flex flex-wrap gap-1">
                        {r.proof_path && (
                          <>
                            <IconBtn title="عرض" onClick={() => openProof(r)}><Eye className="h-3.5 w-3.5" /></IconBtn>
                            <IconBtn title="تنزيل" onClick={() => downloadProof(r)}><Download className="h-3.5 w-3.5" /></IconBtn>
                          </>
                        )}
                        <IconBtn title="تعديل" onClick={() => setEditing(r)}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                        <IconBtn title="حذف" tone="destructive" onClick={() => setConfirmDel(r)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && tenantAccountId && (
        <AddCollectionDialog
          unitId={unitId}
          tenantAccountId={tenantAccountId}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); load(); onChanged?.(); }}
        />
      )}

      {editing && (
        <EditCollectionDialog
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); onChanged?.(); }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        title="حذف الدفعة"
        description={confirmDel ? `سيتم حذف الدفعة (${fmt(confirmDel.amount)} ر.س) نهائياً مع إثبات الدفع المرفق.` : ""}
        confirmLabel="حذف نهائي"
        variant="destructive"
        reasonRequired={false}
        onConfirm={doDelete}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}

function KV({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "rose" | "amber" }) {
  const cls = tone === "emerald" ? "text-emerald-700" : tone === "rose" ? "text-rose-700" : tone === "amber" ? "text-amber-700" : "text-foreground";
  return (
    <div className="rounded-lg border bg-card p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("num text-sm font-extrabold", cls)}>{value}</div>
    </div>
  );
}

function IconBtn({ children, onClick, title, tone }: { children: React.ReactNode; onClick: () => void; title: string; tone?: "destructive" }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "rounded-md border p-1.5 hover:bg-secondary",
        tone === "destructive" ? "border-destructive/40 text-destructive hover:bg-destructive/10" : "border-border"
      )}
    >
      {children}
    </button>
  );
}

// ========== Add dialog ==========
function AddCollectionDialog({
  unitId, tenantAccountId, onClose, onCreated,
}: {
  unitId: string; tenantAccountId: string; onClose: () => void; onCreated: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("أدخل مبلغاً أكبر من صفر");
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      let proofPath: string | null = null;
      let proofName: string | null = null;
      let proofMime: string | null = null;
      let proofSize: number | null = null;
      if (file) {
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
        const path = `${tenantAccountId}/${unitId}/${crypto.randomUUID()}${ext ? "." + ext : ""}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        proofPath = path;
        proofName = (fileName.trim() || file.name);
        proofMime = file.type;
        proofSize = file.size;
      }
      const { error } = await supabase.from("unit_collections" as any).insert({
        unit_id: unitId,
        tenant_account_id: tenantAccountId,
        amount: amt,
        proof_path: proofPath,
        proof_name: proofName,
        proof_mime: proofMime,
        proof_size: proofSize,
        created_by: userData?.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("تم تسجيل الدفعة");
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div dir="rtl" className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <h3 className="font-display text-base font-bold">إضافة دفعة</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">المبلغ المدفوع (ر.س) *</label>
            <Input type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">إثبات الدفع (اختياري)</label>
            <input
              ref={fileRef}
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                setFileName(f?.name ?? "");
              }}
              className="hidden"
            />
            {!file ? (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 p-4 text-xs text-muted-foreground hover:bg-secondary">
                <Upload className="h-4 w-4" /> اختر ملفاً
              </button>
            ) : (
              <div className="space-y-2 rounded-xl border p-3">
                <div className="flex items-center gap-2 text-xs">
                  <Paperclip className="h-3.5 w-3.5 text-primary" />
                  <span className="truncate">{file.name}</span>
                  <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                  <button onClick={() => { setFile(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; }} className="mr-auto rounded p-1 hover:bg-secondary"><X className="h-3.5 w-3.5" /></button>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">اسم الملف</label>
                  <Input value={fileName} onChange={(e) => setFileName(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
            )}
          </div>
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? "جارٍ الحفظ…" : "حفظ الدفعة"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ========== Edit dialog ==========
function EditCollectionDialog({ row, onClose, onSaved }: { row: UnitCollection; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(String(row.amount));
  const [name, setName] = useState(row.proof_name ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("أدخل مبلغاً صحيحاً");
    setBusy(true);
    try {
      const patch: any = { amount: amt };
      if (file) {
        // replace file
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
        const path = `${row.tenant_account_id}/${row.unit_id}/${crypto.randomUUID()}${ext ? "." + ext : ""}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        if (row.proof_path) await supabase.storage.from(BUCKET).remove([row.proof_path]);
        patch.proof_path = path;
        patch.proof_name = name.trim() || file.name;
        patch.proof_mime = file.type;
        patch.proof_size = file.size;
      } else if (row.proof_path && name.trim() && name.trim() !== row.proof_name) {
        patch.proof_name = name.trim();
      }
      const { error } = await supabase.from("unit_collections" as any).update(patch).eq("id", row.id);
      if (error) throw error;
      toast.success("تم الحفظ");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div dir="rtl" className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <h3 className="font-display text-base font-bold">تعديل الدفعة</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">المبلغ (ر.س)</label>
            <Input type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" />
          </div>
          {row.proof_path && (
            <div>
              <label className="mb-1 block text-xs font-medium">اسم الملف الحالي</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium">استبدال إثبات الدفع (اختياري)</label>
            <input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed p-3 text-xs text-muted-foreground hover:bg-secondary">
              <RefreshCcw className="h-3.5 w-3.5" /> {file ? file.name : "اختر ملفاً بديلاً"}
            </button>
          </div>
          <Button onClick={save} disabled={busy} className="w-full">{busy ? "…" : "حفظ التعديل"}</Button>
        </div>
      </div>
    </div>
  );
}
