import { Phone } from "lucide-react";
import { COMPANY, CONTACT } from "@/lib/config";
import logo from "@/assets/logo-nukhbat.jpeg";

export const Header = () => {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-lg">
      <div className="container-tight flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src={logo}
            alt="شعار شركة نخبة تسكين العقارية"
            className="h-12 w-auto object-contain sm:h-14"
          />
          <div className="leading-tight">
            <div className="font-display text-sm font-bold text-foreground sm:text-base">
              {COMPANY.name}
            </div>
            <div className="hidden text-[11px] text-muted-foreground sm:block">
              {COMPANY.tagline}
            </div>
          </div>
        </div>

        <a
          href={`tel:${CONTACT.phone.replace(/\s/g, "")}`}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:text-primary sm:text-sm"
        >
          <Phone className="h-3.5 w-3.5" />
          <span className="num text-[11px] sm:text-sm">0595650716</span>
        </a>
      </div>
    </header>
  );
};
