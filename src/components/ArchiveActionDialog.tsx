import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MIN_REASON_LENGTH } from "@/lib/safetyRules";

export type ArchiveTable = "leads" | "interested_customers" | "customer_profiles" | "tenant_accounts";

export type ArchiveTarget = { id: string; label: string; restore?: boolean } | null;

/** Archive or restore a record through the database function (reason required, logged in audit). */
export function ArchiveActionDialog({
  table,
  target,
  onClose,
  onDone,
}: {
  table: ArchiveTable;
  target: ArchiveTarget;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const restore = !!target?.restore;

  const run = async (reason: string) => {
    if (!target) return;
    setBusy(true);
    const { error } = await supabase.rpc((restore ? "unarchive_record" : "archive_record") as any, {
      _table: table,
      _id: target.id,
      _reason: reason,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(restore ? "تم الاسترجاع من الأرشيف" : "تمت الأرشفة");
    onClose();
    onDone();
  };

  return (
    <ConfirmDialog
      open={!!target}
      title={restore ? "استرجاع من الأرشيف" : "أرشفة السجل"}
      description={
        target
          ? restore
            ? `هيرجع «${target.label}» للقائمة النشطة.`
            : `«${target.label}» هيتخفي من القائمة ويتحفظ في الأرشيف مع السبب. مفيش حذف نهائي.`
          : ""
      }
      confirmLabel={restore ? "استرجاع" : "أرشفة"}
      variant={restore ? "primary" : "destructive"}
      loading={busy}
      minReasonLength={MIN_REASON_LENGTH}
      reasonPlaceholder="اكتب السبب (5 أحرف على الأقل)..."
      onConfirm={run}
      onCancel={onClose}
    />
  );
}

export function ShowArchivedToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-primary" />
      إظهار المؤرشف
    </label>
  );
}
