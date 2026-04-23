import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  href: string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  form?: string;
}

/**
 * زر إرسال الطلب عبر واتساب - يفتح المحادثة في نافذة جديدة
 * WhatsApp submit button — opens chat in new tab.
 */
export const WhatsAppButton = ({ href, disabled, className, children, onClick, type = "button", form }: Props) => {
  const content = (
    <>
      <MessageCircle className="h-5 w-5" strokeWidth={2.5} />
      <span>{children ?? "إرسال الطلب عبر واتساب"}</span>
    </>
  );

  const classes = cn(
    "inline-flex w-full items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 font-display text-base font-bold transition-all",
    "bg-[#25D366] text-white shadow-card hover:bg-[#1eaf56] hover:shadow-elevated",
    "disabled:pointer-events-none disabled:opacity-50",
    className
  );

  if (type === "submit") {
    return (
      <button type="submit" form={form} disabled={disabled} onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }

  return (
    <a
      href={disabled ? undefined : href}
      onClick={onClick}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={disabled}
      className={classes}
    >
      {content}
    </a>
  );
};
