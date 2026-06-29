import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Upload, Download, Trash2, FileText, Paperclip, Loader2 } from "lucide-react";

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
  const [customName, setCustomName] = useState("");
  const [notes, setNotes] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

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
      setCustomName("");
      setNotes("");
      setPendingFile(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tenantAccountId]);

  const onPick = (f: File | null) => {
    setPendingFile(f);
    if (f && !customName.trim()) {
      setCustomName(f.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const upload = async () => {
    if (!pendingFile) {
      toast.error("اختر ملفاً أولاً");
      return;
    }
    if (!customName.trim()) {
      toast.error("اكتب اسماً للملف");
      return;
    }
    setUploading(true);
    try {
      const ext = pendingFile.name.split(".").pop() || "bin";
      const path = `${tenantAccountId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, pendingFile, { contentType: pendingFile.type || undefined, upsert: false });
      if (upErr) throw upErr;
      const { data: userRes } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("tenant_account_files" as any).insert({
        tenant_account_id: tenantAccountId,
        custom_name: customName.trim(),
        original_name: pendingFile.name,
        storage_path: path,
        mime_type: pendingFile.type || null,
        size_bytes: pendingFile.size,
        notes: notes.trim() || null,
        uploaded_by: userRes.user?.id ?? null,
      });
      if (insErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insErr;
      }
      toast.success("تم رفع الملف");
      setPendingFile(null);
      setCustomName("");
      setNotes("");
      load();
    } catch (e: any) {
      toast.error("فشل الرفع: " + (e?.message ?? e));
    } finally {
      setUploading(false);
    }
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
            <div className="mb-2 text-sm font-semibold">رفع ملف جديد</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="اسم الملف (مثلاً: العقد، صورة الهوية...)"
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                type="file"
                onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات (اختياري)"
                rows={2}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
              />
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={upload}
                disabled={uploading || !pendingFile}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                رفع
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
