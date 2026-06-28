import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileIcon, Download, Trash2, Paperclip } from "lucide-react";

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
  const [customName, setCustomName] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<File | null>(null);
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

  const onPick = (f: File | null) => {
    setPending(f);
    if (f && !customName) {
      const dot = f.name.lastIndexOf(".");
      setCustomName(dot > 0 ? f.name.slice(0, dot) : f.name);
    }
  };

  const upload = async () => {
    if (!pending) return toast.error("اختر ملف أولاً");
    const name = customName.trim();
    if (!name) return toast.error("اكتب اسم الملف");
    setUploading(true);
    try {
      const dot = pending.name.lastIndexOf(".");
      const ext = dot > 0 ? pending.name.slice(dot) : "";
      const display = name.endsWith(ext) ? name : `${name}${ext}`;
      const path = `${unitId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, pending, {
        contentType: pending.type || undefined,
        upsert: false,
      });
      if (upErr) throw upErr;

      const { data: u } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("unit_files").insert({
        unit_id: unitId,
        file_name: display,
        storage_path: path,
        mime_type: pending.type || null,
        size_bytes: pending.size,
        uploaded_by: u.user?.id ?? null,
        uploaded_by_email: u.user?.email ?? null,
        notes: notes.trim() || null,
      });
      if (insErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insErr;
      }
      toast.success("تم رفع الملف");
      setPending(null);
      setCustomName("");
      setNotes("");
      if (inputRef.current) inputRef.current.value = "";
      load();
    } catch (e: any) {
      toast.error(e.message || "فشل الرفع");
    } finally {
      setUploading(false);
    }
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
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-primary">
          <Upload className="h-4 w-4" /> رفع ملف جديد
        </div>
        <div className="grid gap-2">
          <Input
            ref={inputRef}
            type="file"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            className="text-xs"
          />
          <Input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="اكتب اسم الملف (بدون الامتداد إن أحببت)"
            className="text-xs"
          />
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="ملاحظات (اختياري)"
            className="min-h-[60px] text-xs"
          />
          <Button onClick={upload} disabled={uploading || !pending} size="sm" className="w-full">
            {uploading ? "جاري الرفع…" : "رفع الملف"}
          </Button>
        </div>
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
