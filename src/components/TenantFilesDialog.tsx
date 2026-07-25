import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  X, Upload, Download, Trash2, FileText, Paperclip, Loader2, Plus,
  Archive, ArchiveRestore, Pencil, RefreshCw, Eye,
} from "lucide-react";

interface TenantFile {
  id: string;
  custom_name: string;
  original_name: string | null;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  notes: string | null;
  created_at: string;
  is_archived: boolean;
  archived_at: string | null;
  uploaded_by: string | null;
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

const ACCEPT = ".pdf,.doc,.docx,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function TenantFilesDialog({ open, tenantAccountId, tenantName, onClose }: Props) {
  const [files, setFiles] = useState<TenantFile[]>([]);
  const [uploaderMap, setUploaderMap] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"active" | "archived">("active");
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
    else {
      const list = (data as any) ?? [];
      setFiles(list);
      const ids = Array.from(new Set(list.map((f: any) => f.uploaded_by).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("user_id, display_name, email").in("user_id", ids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => { map[p.user_id] = p.display_name || p.email || ""; });
        setUploaderMap(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      load();
      setPending([]);
      setTab("active");
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
    if (pending.length === 0) { toast.error("اختر ملفات أولاً"); return; }
    if (pending.some((p) => !p.customName.trim())) { toast.error("اكتب اسماً لكل ملف"); return; }
    setUploading(true);
    const { data: userRes } = await supabase.auth.getUser();
    let ok = 0, fail = 0;
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

  const signedUrl = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) { toast.error("تعذر إنشاء الرابط"); return null; }
    return data.signedUrl;
  };

  const view = async (f: TenantFile) => {
    const u = await signedUrl(f.storage_path);
    if (u) window.open(u, "_blank");
  };
  const download = view; // signed URL works for both

  const rename = async (f: TenantFile) => {
    const next = window.prompt("اسم الملف الجديد", f.custom_name);
    if (!next || !next.trim() || next.trim() === f.custom_name) return;
    const { error } = await supabase.from("tenant_account_files" as any)
      .update({ custom_name: next.trim() }).eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("تم التعديل"); load();
  };

  const replace = async (f: TenantFile, file: File) => {
    try {
      const ext = file.name.split(".").pop() || "bin";
      const newPath = `${tenantAccountId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET).upload(newPath, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) throw upErr;
      const { error: uErr } = await supabase.from("tenant_account_files" as any).update({
        storage_path: newPath,
        original_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      }).eq("id", f.id);
      if (uErr) {
        await supabase.storage.from(BUCKET).remove([newPath]);
        throw uErr;
      }
      await supabase.storage.from(BUCKET).remove([f.storage_path]);
      toast.success("تم استبدال الملف"); load();
    } catch (e: any) {
      toast.error(e?.message ?? String(e));
    }
  };

  const archive = async (f: TenantFile) => {
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from("tenant_account_files" as any).update({
      is_archived: true, archived_at: new Date().toISOString(), archived_by: userRes.user?.id ?? null,
    }).eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("تم الأرشفة"); load();
  };

  const restore = async (f: TenantFile) => {
    const { error } = await supabase.from("tenant_account_files" as any).update({
      is_archived: false, archived_at: null, archived_by: null,
    }).eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("تمت الاستعادة"); load();
  };

  const remove = async (f: TenantFile) => {
    if (!confirm(`حذف الملف "${f.custom_name}" نهائياً؟`)) return;
    const { error: dErr } = await supabase.from("tenant_account_files" as any).delete().eq("id", f.id);
    if (dErr) return toast.error("فشل الحذف: " + dErr.message);
    await supabase.storage.from(BUCKET).remove([f.storage_path]);
    toast.success("تم الحذف"); load();
  };

  if (!open) return null;

  const visible = files.filter((f) => (tab === "active" ? !f.is_archived : f.is_archived));
  const activeCount = files.filter((f) => !f.is_archived).length;
  const archivedCount = files.length - activeCount;

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
              <h3 className="font-display text-base font-bold">الملفات العامة للمستأجر</h3>
              <div className="text-xs text-muted-foreground">{tenantName}</div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-60px)] overflow-y-auto p-4">
          {/* Uploader */}
          <div className="mb-5 rounded-2xl border border-dashed border-border bg-secondary/30 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold">رفع ملفات جديدة</div>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-xs hover:bg-secondary">
                <Plus className="h-3 w-3" /> اختيار ملفات
                <input
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }}
                />
              </label>
            </div>

            {pending.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                يدعم PDF والصور وملفات Word — اكتب اسماً واضحاً لكل ملف (مثال: السجل التجاري، هوية المستأجر...).
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
                      placeholder="اسم الملف (مطلوب)"
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

          {/* Tabs */}
          <div className="mb-3 flex gap-1 rounded-xl border border-border bg-background p-1">
            <button
              onClick={() => setTab("active")}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === "active" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              الملفات النشطة ({activeCount})
            </button>
            <button
              onClick={() => setTab("archived")}
              className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === "archived" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              المؤرشفة ({archivedCount})
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">جارٍ التحميل...</div>
          ) : visible.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {tab === "active" ? "لا توجد ملفات" : "لا توجد ملفات مؤرشفة"}
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((f) => (
                <div key={f.id} className={`rounded-xl border border-border bg-background p-3 ${f.is_archived ? "opacity-70" : ""}`}>
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{f.custom_name}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {f.original_name && <span>{f.original_name} • </span>}
                        {f.mime_type && <span>{f.mime_type} • </span>}
                        {fmtSize(f.size_bytes)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        رُفع في {new Date(f.created_at).toLocaleDateString("ar-EG-u-nu-latn")}
                        {f.uploaded_by && uploaderMap[f.uploaded_by] && <> · بواسطة {uploaderMap[f.uploaded_by]}</>}
                      </div>
                      {f.notes && <div className="mt-1 text-[11px] text-muted-foreground">{f.notes}</div>}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
                    <button onClick={() => view(f)} title="عرض" className="rounded-lg border border-border p-1.5 hover:bg-secondary">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => download(f)} title="تحميل" className="rounded-lg border border-border p-1.5 hover:bg-secondary">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    {!f.is_archived && (
                      <>
                        <button onClick={() => rename(f)} title="تعديل الاسم" className="rounded-lg border border-border p-1.5 hover:bg-secondary">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <label title="استبدال الملف" className="cursor-pointer rounded-lg border border-border p-1.5 hover:bg-secondary">
                          <RefreshCw className="h-3.5 w-3.5" />
                          <input
                            type="file"
                            accept={ACCEPT}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.currentTarget.value = "";
                              if (file) replace(f, file);
                            }}
                          />
                        </label>
                        <button onClick={() => archive(f)} title="أرشفة" className="rounded-lg border border-border p-1.5 hover:bg-secondary">
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    {f.is_archived && (
                      <button onClick={() => restore(f)} title="استعادة" className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-1.5 text-emerald-700 hover:bg-emerald-500/20">
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => remove(f)} title="حذف نهائي" className="rounded-lg bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
