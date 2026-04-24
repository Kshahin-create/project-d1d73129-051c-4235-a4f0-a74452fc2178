import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { WHATSAPP_NUMBER, COMPANY } from "@/lib/config";

/**
 * زر واتساب عائم ثابت في الزاوية لسهولة وصول العملاء للتواصل المباشر
 * Floating WhatsApp button — fixed corner FAB for instant contact.
 */
export const FloatingWhatsApp = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  const message = encodeURIComponent(
    `السلام عليكم،\nأرغب بالاستفسار عن وحدات المدينة الصناعية بشمال مكة المكرمة.\n\n— عبر موقع ${COMPANY.name}`
  );
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل عبر واتساب"
      className={`group fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-elevated transition-all duration-500 hover:bg-[#1eaf56] hover:shadow-card sm:bottom-6 sm:left-6 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      {/* نبضة خفيفة لجذب الانتباه */}
      <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366]/40" />
      <MessageCircle className="h-6 w-6" strokeWidth={2.5} />
      <span className="hidden font-display text-sm font-bold sm:inline">
        تواصل واتساب
      </span>
    </a>
  );
};
