import { X, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "primary" | "destructive";
  reasonRequired?: boolean;
  reasonPlaceholder?: string;
  reasonSuggestions?: string[];
  loading?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel,
  variant = "primary",
  reasonRequired = true,
  reasonPlaceholder = "اكتب سبب التغيير...",
  reasonSuggestions = [],
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    if (reasonRequired && reason.trim().length < 3) {
      setError("الرجاء كتابة سبب لا يقل عن 3 أحرف");
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              variant === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-medium">
            سبب التغيير {reasonRequired && <span className="text-destructive">*</span>}
          </label>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError("");
            }}
            placeholder={reasonPlaceholder}
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}

          {reasonSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {reasonSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setReason(s); setError(""); }}
                  className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-border bg-card py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-sm font-bold text-primary-foreground shadow-card hover:shadow-elevated disabled:opacity-50",
              variant === "destructive" ? "bg-destructive hover:bg-destructive/90" : "bg-gradient-primary"
            )}
          >
            {loading ? "جاري التنفيذ..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
