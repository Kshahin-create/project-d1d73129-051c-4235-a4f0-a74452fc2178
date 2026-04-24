import { useState } from "react";
import { MessageCircle, Copy, Check, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/whatsapp";
import { useToast } from "@/hooks/use-toast";

interface Props {
  /** رابط wa.me الأساسي (يفتح التطبيق على الجوال) */
  href: string;
  /** رابط واتساب ويب البديل (للأجهزة بدون التطبيق) */
  webHref?: string;
  /** نص الرسالة الخام للنسخ التلقائي إلى الحافظة */
  message?: string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

/**
 * زر إرسال الطلب عبر واتساب
 * - ينسخ نص الرسالة تلقائياً إلى الحافظة
 * - يفتح واتساب (تطبيق على الجوال / ويب على الكمبيوتر)
 * - يوفّر رابطاً بديلاً لواتساب ويب إذا لم يُفتح التطبيق
 */
export const WhatsAppButton = ({
  href,
  webHref,
  message,
  disabled,
  className,
  children,
  onClick,
}: Props) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [opened, setOpened] = useState(false);

  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  const handleSend = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (disabled) return;

    // 1) نسخ الرسالة إلى الحافظة (كحل احتياطي للصق اليدوي)
    if (message) {
      const ok = await copyToClipboard(message);
      if (ok) {
        setCopied(true);
        toast({
          title: "تم نسخ الرسالة",
          description: "نُسخت تفاصيل الطلب — يمكنك لصقها في واتساب إذا لزم الأمر.",
        });
        setTimeout(() => setCopied(false), 3000);
      }
    }

    // 2) فتح واتساب في تبويب جديد
    const win = window.open(href, "_blank", "noopener,noreferrer");

    // 3) إن فشل الفتح (نوافذ منبثقة محظورة)، استخدم نفس النافذة
    if (!win || win.closed || typeof win.closed === "undefined") {
      window.location.href = href;
    }

    setOpened(true);
    onClick?.();
  };

  const handleWebFallback = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.stopPropagation();
    // يفتح كرابط طبيعي
  };

  const baseClasses = cn(
    "inline-flex w-full items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 font-display text-base font-bold transition-all",
    "bg-[#25D366] text-white shadow-card hover:bg-[#1eaf56] hover:shadow-elevated",
    "disabled:pointer-events-none disabled:opacity-50",
    className
  );

  return (
    <div className="space-y-2.5">
      <button type="button" disabled={disabled} onClick={handleSend} className={baseClasses}>
        {copied ? (
          <Check className="h-5 w-5" strokeWidth={2.5} />
        ) : (
          <MessageCircle className="h-5 w-5" strokeWidth={2.5} />
        )}
        <span>{children ?? "إرسال الطلب عبر واتساب"}</span>
      </button>

      {/* رابط بديل صريح يظهر دائماً ليتأكد المستخدم من وصول الرسالة */}
      {webHref && (
        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className="text-xs text-muted-foreground">
            {opened
              ? "لم يُفتح واتساب؟ جرّب الرابط البديل:"
              : isMobile
                ? "إذا لم يكن واتساب مثبّتاً، استخدم الرابط البديل:"
                : "أو افتح عبر واتساب ويب مباشرة:"}
          </p>
          <a
            href={webHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleWebFallback}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            فتح في واتساب ويب
          </a>
          {message && (
            <button
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(message);
                if (ok) {
                  toast({ title: "تم نسخ الرسالة بنجاح" });
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-primary"
            >
              <Copy className="h-3 w-3" />
              نسخ نص الرسالة
            </button>
          )}
        </div>
      )}
    </div>
  );
};
