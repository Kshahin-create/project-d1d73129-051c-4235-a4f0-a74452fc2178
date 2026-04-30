import { Phone, LogIn } from "lucide-react";
import { Link } from "react-router-dom";
import { COMPANY, CONTACT } from "@/lib/config";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo-nukhbat.jpeg";

export const Header = () => {
  const { user, loading } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-lg">
      <div className="container-tight flex h-16 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-4">
        <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <img
            src={logo}
            alt="شعار شركة نخبة تسكين العقارية"
            className="h-10 w-auto shrink-0 object-contain sm:h-14"
          />
          <div className="min-w-0 leading-tight">
            <div className="truncate font-display text-[13px] font-bold text-foreground sm:text-base">
              {COMPANY.name}
            </div>
            <div className="hidden text-[11px] text-muted-foreground sm:block">
              {COMPANY.tagline}
            </div>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {!loading && !user && (
            <Link
              to="/auth"
              className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground transition hover:opacity-90 sm:gap-1.5 sm:px-3 sm:text-sm"
              aria-label="تسجيل الدخول"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span className="hidden xs:inline sm:inline">دخول</span>
            </Link>
          )}
          <a
            href="tel:0595650716"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/40 hover:text-primary sm:px-3 sm:text-sm"
            aria-label="اتصل بنا"
          >
            <Phone className="h-3.5 w-3.5" />
            <span className="num text-[11px] sm:text-sm">0595650716</span>
          </a>
        </div>
      </div>
    </header>
  );
};
