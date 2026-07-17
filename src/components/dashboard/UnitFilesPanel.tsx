import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileIcon, Download, Trash2, Paperclip, X, Plus } from "lucide-react";

type FileRow = {
  id: string;
  unit_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by_email: string | null;
  notes: string | null;
  created_at: string;
};

interface PendingItem {
  id: string;
  file: File;
  customName: string;
  notes: string;
}

const BUCKET = "unit-files";
const fmtSize = (n: number | null) => {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};
const fmtDate = (d: string) =>
  new Date(d).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });

export function UnitFilesPanel({ unitId }: { unitId: string }) {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("unit_files")
      .select("*")
      .eq("unit_id", unitId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setFiles((data ?? []) as FileRow[]);
    setLoading(false);
  };

  useEffect(() => { if (unitId) load(); /* eslint-disable-next-line */ }, [unitId]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const items: PendingItem[] = Array.from(list).map((f) => {
      const dot = f.name.lastIndexOf(".");
      return {
        id: crypto.randomUUID(),
        file: f,
        customName: dot > 0 ? f.name.slice(0, dot) : f.name,
        notes: "",
      };
    });
    setPending((p) => [...p, ...items]);
  };

  const updatePending = (id: string, patch: Partial<PendingItem>) =>
    setPending((p) => p.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removePending = (id: string) => setPending((p) => p.filter((it) => it.id !== id));

  const uploadAll = async () => {
    if (pending.length === 0) return toast.error("اختر ملفات أولاً");
    if (pending.some((p) => !p.customName.trim())) return toast.error("اكتب اسماً لكل ملف");
    setUploading(true);
    const { data: u } = await supabase.auth.getUser();
    let ok = 0, fail = 0;
    for (const item of pending) {
      try {
        const dot = item.file.name.lastIndexOf(".");
        const ext = dot > 0 ? item.file.name.slice(dot) : "";
        const name = item.customName.trim();
        const display = name.endsWith(ext) ? name : `${name}${ext}`;
        const path = `${unitId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, item.file, {
          contentType: item.file.type || undefined,
          upsert: false,
        });
        if (upErr) throw upErr;

        const { error: insErr } = await supabase.from("unit_files").insert({
          unit_id: unitId,
          file_name: display,
          storage_path: path,
          mime_type: item.file.type || null,
          size_bytes: item.file.size,
          uploaded_by: u.user?.id ?? null,
          uploaded_by_email: u.user?.email ?? null,
          notes: item.notes.trim() || null,
        });
        if (insErr) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw insErr;
        }
        ok++;
      } catch (e: any) {
        fail++;
        toast.error(`فشل "${item.customName}": ${e.message ?? e}`);
      }
    }
    if (ok > 0) toast.success(`تم رفع ${ok} ملف${fail ? ` (فشل ${fail})` : ""}`);
    setPending([]);
    if (inputRef.current) inputRef.current.value = "";
    setUploading(false);
    load();
  };

  const download = async (f: FileRow) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 60, {
      download: f.file_name,
    });
    if (error || !data) return toast.error(error?.message || "تعذر التنزيل");
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (f: FileRow) => {
    if (!confirm(`حذف الملف "${f.file_name}"؟`)) return;
    const { error: sErr } = await supabase.storage.from(BUCKET).remove([f.storage_path]);
    if (sErr) toast.error(sErr.message);
    const { error: dErr } = await supabase.from("unit_files").delete().eq("id", f.id);
    if (dErr) return toast.error(dErr.message);
    toast.success("تم حذف الملف");
    load();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-gradient-to-b from-primary/5 to-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <Upload className="h-4 w-4" /> رفع ملفات جديدة
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border bg-background px-2 py-1 text-xs hover:bg-secondary">
            <Plus className="h-3 w-3" /> اختيار
            <input
              ref={inputRef}
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
          <div className="py-3 text-center text-[11px] text-muted-foreground">
            اضغط "اختيار" لإضافة ملف واحد أو أكثر
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((it) => (
              <div key={it.id} className="rounded-lg border bg-background p-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
                    {it.file.name} • {fmtSize(it.file.size)}
                  </div>
                  <button
                    onClick={() => removePending(it.id)}
                    className="rounded p-0.5 text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <Input
                  value={it.customName}
                  onChange={(e) => updatePending(it.id, { customName: e.target.value })}
                  placeholder="اسم الملف"
                  className="mb-1 h-7 text-xs"
                />
                <Input
                  value={it.notes}
                  onChange={(e) => updatePending(it.id, { notes: e.target.value })}
                  placeholder="ملاحظات (اختياري)"
                  className="h-7 text-xs"
                />
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={uploadAll}
          disabled={uploading || pending.length === 0}
          size="sm"
          className="mt-2 w-full"
        >
          {uploading ? "جاري الرفع…" : `رفع ${pending.length > 0 ? `(${pending.length})` : ""}`}
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs font-bold">
        <Paperclip className="h-4 w-4" /> الملفات المرفقة ({files.length})
      </div>

      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : files.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-xs text-muted-foreground">
          لا توجد ملفات بعد
        </div>
      ) : (
        files.map((f) => (
          <div key={f.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FileIcon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate text-sm font-bold">{f.file_name}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span>{fmtSize(f.size_bytes)}</span>
                  {f.mime_type && <span>{f.mime_type}</span>}
                  <span>{fmtDate(f.created_at)}</span>
                  {f.uploaded_by_email && <span>{f.uploaded_by_email}</span>}
                </div>
                {f.notes && <div className="mt-1 text-[11px] text-muted-foreground">{f.notes}</div>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="outline" onClick={() => download(f)} className="h-8 px-2">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(f)} className="h-8 px-2 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
