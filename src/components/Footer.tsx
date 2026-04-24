import { Link } from "react-router-dom";
import { Instagram, Mail, MapPin, Phone } from "lucide-react";
import { COMPANY, CONTACT, PROJECT, SOCIAL } from "@/lib/config";
import logo from "@/assets/logo-nukhbat.jpeg";

/** أيقونة تيك توك (مخصّصة لأنها غير متوفّرة في lucide-react) */
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.5a8.16 8.16 0 0 0 4.77 1.52V6.69a4.85 4.85 0 0 1-1.84 0Z" />
  </svg>
);

export const Footer = () => {
  return (
    <footer className="mt-24 border-t border-border/60 bg-secondary/40">
      <div className="container-tight py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="شعار شركة نخبة تسكين العقارية"
                className="h-14 w-auto object-contain"
              />
              <span className="font-display font-bold">{COMPANY.name}</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              مدير التشغيل والتأجير لـ <strong className="text-foreground">{PROJECT.nameAr}</strong>
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <h3 className="font-display font-bold text-foreground">الجهات المعنية</h3>
            <p className="text-muted-foreground"><span className="text-foreground">المالك:</span> {PROJECT.owner}</p>
            <p className="text-muted-foreground"><span className="text-foreground">المستثمر:</span> {PROJECT.investor}</p>
            <p className="text-muted-foreground"><span className="text-foreground">مدير التشغيل والتأجير:</span> {PROJECT.operator}</p>
          </div>

          <div className="space-y-2 text-sm">
            <h3 className="font-display font-bold text-foreground">تواصل معنا</h3>
            <a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-muted-foreground transition hover:text-primary">
              <Phone className="h-4 w-4" /> <span className="num">{CONTACT.phone}</span>
            </a>
            <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-2 text-muted-foreground transition hover:text-primary">
              <Mail className="h-4 w-4" /> {CONTACT.email}
            </a>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" /> شمال مكة المكرمة
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-center text-xs text-muted-foreground sm:flex-row sm:text-right">
          <div>© {new Date().getFullYear()} {COMPANY.name}. جميع الحقوق محفوظة.</div>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="transition hover:text-primary">سياسة الخصوصية والأمان</Link>
            <span className="text-border">|</span>
            <Link to="/terms" className="transition hover:text-primary">الشروط والأحكام</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
