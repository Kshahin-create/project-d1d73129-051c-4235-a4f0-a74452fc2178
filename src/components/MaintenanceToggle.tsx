import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Wrench, Loader2 } from "lucide-react";

export const MaintenanceToggle = () => {
  const { isAdmin } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("maintenance_mode, maintenance_message")
        .eq("id", 1)
        .maybeSingle();
      setEnabled(!!data?.maintenance_mode);
      setMessage(data?.maintenance_message ?? "");
      setLoading(false);
    })();
  }, [isAdmin]);

  if (!isAdmin) return null;

  const save = async (next: boolean) => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({
        maintenance_mode: next,
        maintenance_message: message || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast.error("فشل التحديث: " + error.message);
      return;
    }
    setEnabled(next);
    toast.success(next ? "تم تفعيل وضع الصيانة" : "تم إيقاف وضع الصيانة");
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> جاري التحميل…
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className={`rounded-2xl border p-5 transition ${
        enabled ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            enabled ? "bg-amber-500/15 text-amber-600" : "bg-primary/10 text-primary"
          }`}
        >
          <Wrench className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold">وضع الصيانة</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                لما يكون مفعّل: كل الزوار يشوفوا صفحة صيانة، والأدمن فقط يقدر يدخل عادي.
              </p>
            </div>
            <button
              onClick={() => save(!enabled)}
              disabled={saving}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                enabled ? "bg-amber-500" : "bg-muted"
              } disabled:opacity-50`}
              aria-label="تبديل وضع الصيانة"
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition ${
                  enabled ? "-translate-x-6" : "-translate-x-1"
                }`}
              />
            </button>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="رسالة اختيارية تظهر للزوار (مثلاً: هنرجع بعد ساعة)"
            className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            rows={2}
          />
          <button
            onClick={() => save(enabled)}
            disabled={saving}
            className="mt-2 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold hover:bg-secondary/80 disabled:opacity-50"
          >
            حفظ الرسالة
          </button>
        </div>
      </div>
    </div>
  );
};
