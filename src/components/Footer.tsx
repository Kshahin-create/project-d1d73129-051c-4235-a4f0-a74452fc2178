import { Link } from "react-router-dom";
import { Instagram, Mail, MapPin, Phone } from "lucide-react";
import { COMPANY, CONTACT, PROJECT, SOCIAL } from "@/lib/config";
import logo from "@/assets/logo-nukhbat.png";
import madarLogo from "@/assets/madar-al-khaleej-logo.png.asset.json";
import licenseQr from "@/assets/advertising-license-qr.png.asset.json";
import alQimmahLogo from "@/assets/al-qimmah-logo.png.asset.json";
import municipalityLogo from "@/assets/holy-makkah-municipality-logo.png.asset.json";

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
        <section aria-labelledby="stakeholders-heading">
          <div className="mb-6 text-center">
            <h2 id="stakeholders-heading" className="font-display text-lg font-bold text-foreground">
              الجهات المعنية
            </h2>
            <div className="mx-auto mt-2 h-0.5 w-12 bg-primary" />
          </div>

          <div className="grid gap-x-10 border-y border-border/60 sm:grid-cols-2">
            <div className="flex min-h-28 items-center gap-4 py-5 sm:border-l sm:border-border/60">
              <img
                src={municipalityLogo.url}
                alt="شعار أمانة العاصمة المقدسة"
                className="h-20 w-24 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-primary">الجهات الحكومية</p>
                <p className="mt-1 text-sm font-bold leading-relaxed text-foreground">
                  {PROJECT.owner}
                </p>
              </div>
            </div>

            <div className="flex min-h-28 items-center gap-4 py-5">
              <img
                src={alQimmahLogo.url}
                alt="شعار شركة القمة الهادفة الحديثة"
                className="h-20 w-20 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-primary">المستثمر والمطور</p>
                <p className="mt-1 text-sm font-bold leading-relaxed text-foreground">
                  {PROJECT.investor}
                </p>
              </div>
            </div>

            <div className="flex min-h-28 items-center gap-4 border-t border-border/60 py-5 sm:border-l sm:border-border/60">
              <img
                src={logo}
                alt="شعار شركة نخبة تسكين العقارية"
                className="h-16 w-20 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <p className="text-xs font-medium text-primary">مدير الإدارة والتشغيل</p>
                <p className="mt-1 text-sm font-bold leading-relaxed text-foreground">
                  {COMPANY.name}
                </p>
              </div>
            </div>

            <div className="flex min-h-28 items-center gap-3 border-t border-border/60 py-5">
              <img
                src={madarLogo.url}
                alt="شعار مدار الخليج العقاري"
                className="h-16 w-16 shrink-0 object-contain"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-primary">الوسيط العقاري للتسويق والتأجير</p>
                <p className="mt-1 text-sm font-bold text-foreground">مدار الخليج العقاري</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  رقم الترخيص الإعلاني <span className="num font-medium text-foreground">7201145651</span>
                  <span className="mx-1.5 text-border">|</span>
                  عقد وساطة رقم <span className="num font-medium text-foreground">6201095268</span>
                </p>
              </div>
              <img
                src={licenseQr.url}
                alt="رمز الاستجابة السريعة للترخيص الإعلاني"
                className="h-16 w-16 shrink-0 rounded-md bg-background object-contain"
              />
            </div>
          </div>
        </section>

        <section className="mt-8 flex flex-col justify-between gap-6 md:flex-row md:items-start" aria-labelledby="contact-heading">
          <div className="space-y-3 text-sm">
            <h2 id="contact-heading" className="font-display font-bold text-foreground">تواصل معنا</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <a href={`tel:${CONTACT.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-muted-foreground transition hover:text-primary">
                <Phone className="h-4 w-4" /> <span className="num" dir="ltr">{CONTACT.phone}</span>
              </a>
              <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-2 text-muted-foreground transition hover:text-primary">
                <Mail className="h-4 w-4" /> <span dir="ltr">{CONTACT.email}</span>
              </a>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" /> شمال مكة المكرمة
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={SOCIAL.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="حسابنا على إنستقرام"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href={SOCIAL.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="حسابنا على تيك توك"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              <TikTokIcon className="h-4 w-4" />
            </a>
          </div>
        </section>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-center text-xs text-muted-foreground sm:flex-row sm:text-right">
          <div>
            © {new Date().getFullYear()}{" "}
            <a
              href="https://mnicity.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition hover:text-primary"
            >
              {PROJECT.nameAr}
            </a>{" "}
            — جميع الحقوق محفوظة
          </div>
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
