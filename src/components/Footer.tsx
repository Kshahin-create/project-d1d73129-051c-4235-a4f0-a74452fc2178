import { Mail, MapPin, Phone } from "lucide-react";
import { COMPANY, CONTACT, PROJECT } from "@/lib/config";
import logo from "@/assets/logo-nukhbat.jpeg";

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

        <div className="mt-8 border-t border-border/60 pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {COMPANY.name}. جميع الحقوق محفوظة.
        </div>
      </div>
    </footer>
  );
};
