import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Upload, Download, Trash2, FileText, Paperclip, Loader2, Plus } from "lucide-react";

interface TenantFile {
  id: string;
  custom_name: string;
  original_name: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  notes: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  tenantAccountId: string;
  tenantName: string;
  onClose: () => void;
}

interface PendingItem {
  id: string;
  file: File;
  customName: string;
  notes: string;
}

const BUCKET = "tenant-account-files";

const fmtSize = (b?: number | null) => {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
};

export function TenantFilesDialog({ open, tenantAccountId, tenantName, onClose }: Props) {
  const [files, setFiles] = useState<TenantFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<PendingItem[]>([]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tenant_account_files" as any)
      .select("*")
      .eq("tenant_account_id", tenantAccountId)
      .order("created_at", { ascending: false });
    if (error) toast.error("تعذر التحميل: " + error.message);
    else setFiles((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      load();
      setPending([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tenantAccountId]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const items: PendingItem[] = Array.from(list).map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      customName: f.name.replace(/\.[^/.]+$/, ""),
      notes: "",
    }));
    setPending((p) => [...p, ...items]);
  };

  const updatePending = (id: string, patch: Partial<PendingItem>) =>
    setPending((p) => p.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const removePending = (id: string) => setPending((p) => p.filter((it) => it.id !== id));

  const uploadAll = async () => {
    if (pending.length === 0) {
      toast.error("اختر ملفات أولاً");
      return;
    }
    if (pending.some((p) => !p.customName.trim())) {
      toast.error("اكتب اسماً لكل ملف");
      return;
    }
    setUploading(true);
    const { data: userRes } = await supabase.auth.getUser();
    let ok = 0;
    let fail = 0;
    for (const item of pending) {
      try {
        const ext = item.file.name.split(".").pop() || "bin";
        const path = `${tenantAccountId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, item.file, { contentType: item.file.type || undefined, upsert: false });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("tenant_account_files" as any).insert({
          tenant_account_id: tenantAccountId,
          custom_name: item.customName.trim(),
          original_name: item.file.name,
          storage_path: path,
          mime_type: item.file.type || null,
          size_bytes: item.file.size,
          notes: item.notes.trim() || null,
          uploaded_by: userRes.user?.id ?? null,
        });
        if (insErr) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw insErr;
        }
        ok++;
      } catch (e: any) {
        fail++;
        toast.error(`فشل رفع "${item.customName}": ${e?.message ?? e}`);
      }
    }
    if (ok > 0) toast.success(`تم رفع ${ok} ملف${fail ? ` (فشل ${fail})` : ""}`);
    setPending([]);
    setUploading(false);
    load();
  };

  const download = async (f: TenantFile) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("تعذر التنزيل");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (f: TenantFile) => {
    if (!confirm(`حذف الملف "${f.custom_name}"؟`)) return;
    const { error: dErr } = await supabase.from("tenant_account_files" as any).delete().eq("id", f.id);
    if (dErr) {
      toast.error("فشل الحذف: " + dErr.message);
      return;
    }
    await supabase.storage.from(BUCKET).remove([f.storage_path]);
    toast.success("تم الحذف");
    load();
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Paperclip className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-display text-base font-bold">ملفات المستأجر</h3>
              <div className="text-xs text-muted-foreground">{tenantName}</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-60px)] overflow-y-auto p-4">
          <div className="mb-5 rounded-2xl border border-dashed border-border bg-secondary/30 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">رفع ملفات جديدة</div>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-xs hover:bg-secondary">
                <Plus className="h-3 w-3" /> اختيار ملفات
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            {pending.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                اضغط "اختيار ملفات" لإضافة ملف واحد أو أكثر
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map((it) => (
                  <div key={it.id} className="rounded-xl border border-border bg-background p-2">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                        {it.file.name} • {fmtSize(it.file.size)}
                      </div>
                      <button
                        onClick={() => removePending(it.id)}
                        className="rounded-md p-1 text-destructive hover:bg-destructive/10"
                        title="إزالة"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={it.customName}
                      onChange={(e) => updatePending(it.id, { customName: e.target.value })}
                      placeholder="اسم الملف"
                      className="mb-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                    />
                    <input
                      type="text"
                      value={it.notes}
                      onChange={(e) => updatePending(it.id, { notes: e.target.value })}
                      placeholder="ملاحظات (اختياري)"
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <button
                onClick={uploadAll}
                disabled={uploading || pending.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                رفع {pending.length > 0 ? `(${pending.length})` : ""}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">جارٍ التحميل...</div>
          ) : files.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">لا توجد ملفات</div>
          ) : (
            <div className="space-y-2">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-xl border border-border bg-background p-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{f.custom_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {f.original_name && <span>{f.original_name} • </span>}
                      {fmtSize(f.size_bytes)} • {new Date(f.created_at).toLocaleDateString("ar-EG-u-nu-latn")}
                    </div>
                    {f.notes && <div className="mt-0.5 text-[11px] text-muted-foreground">{f.notes}</div>}
                  </div>
                  <button
                    onClick={() => download(f)}
                    className="rounded-lg border border-border p-1.5 hover:bg-secondary"
                    title="تنزيل"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(f)}
                    className="rounded-lg bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20"
                    title="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
