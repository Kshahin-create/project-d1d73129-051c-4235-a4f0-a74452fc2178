import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, UserCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  userId: string;
  avatarUrl: string | null;
  fullName?: string;
  onChange: (url: string | null) => void;
}

export const AvatarUpload = ({ userId, avatarUrl, fullName, onChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const initials = (fullName || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("الملف يجب أن يكون صورة");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("حجم الصورة يجب ألا يتجاوز 3 ميجا");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: dbErr } = await supabase
        .from("customer_profiles")
        .upsert({ user_id: userId, avatar_url: url }, { onConflict: "user_id" });
      if (dbErr) throw dbErr;
      onChange(url);
      toast.success("تم تحديث الصورة");
    } catch (e: any) {
      toast.error(e?.message || "فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      const { error } = await supabase
        .from("customer_profiles")
        .upsert({ user_id: userId, avatar_url: null }, { onConflict: "user_id" });
      if (error) throw error;
      onChange(null);
      toast.success("تم حذف الصورة");
    } catch (e: any) {
      toast.error(e?.message || "فشل حذف الصورة");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-gradient-to-br from-primary/20 to-accent/20 shadow-elevated">
          {avatarUrl ? (
            <img src={avatarUrl} alt="الصورة الشخصية" className="h-full w-full object-cover" />
          ) : initials ? (
            <span className="font-display text-3xl font-extrabold text-primary">{initials}</span>
          ) : (
            <UserCircle2 className="h-16 w-16 text-primary/60" />
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-1 -left-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card transition hover:scale-105 disabled:opacity-50"
          aria-label="رفع صورة"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold hover:border-primary/40 disabled:opacity-50"
        >
          {avatarUrl ? "تغيير الصورة" : "رفع صورة"}
        </button>
        {avatarUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            حذف
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
};
