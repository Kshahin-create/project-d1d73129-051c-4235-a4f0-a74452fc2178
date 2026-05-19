import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import logo from "@/assets/logo-nukhbat.png";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "install_prompt_dismissed_at";
const DISMISS_DAYS = 7;

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true);

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent || "");

export const InstallPrompt = () => {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (location.pathname.startsWith("/install")) return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const expired = Date.now() - dismissedAt > DISMISS_DAYS * 24 * 60 * 60 * 1000;
    if (!expired) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS doesn't fire beforeinstallprompt; show manual hint after delay
    if (isIOS()) {
      const t = setTimeout(() => {
        setIosHint(true);
        setShow(true);
      }, 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBIP);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, [location.pathname]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted" || choice.outcome === "dismissed") {
      dismiss();
      setDeferred(null);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:bottom-4 sm:right-4 sm:left-auto sm:px-0 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="mx-auto sm:mx-0 max-w-md rounded-2xl border border-border bg-card shadow-elevated overflow-hidden">
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary border border-border/60">
            <img src={logo} alt="" className="h-9 w-auto object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground text-sm leading-tight">
              نزّل التطبيق على هاتفك
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {iosHint
                ? "اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية» لتثبيت التطبيق."
                : "تجربة أسرع وأسهل — ثبّت موقع نخبة تسكين كتطبيق بضغطة واحدة."}
            </p>

            {iosHint && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-foreground bg-secondary rounded-lg px-2 py-1.5">
                <Share className="h-3.5 w-3.5 text-primary" />
                <span>←</span>
                <Plus className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">الشاشة الرئيسية</span>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              {deferred ? (
                <button
                  onClick={handleInstall}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  تثبيت الآن
                </button>
              ) : (
                <Link
                  to="/install"
                  onClick={dismiss}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  طريقة التثبيت
                </Link>
              )}
              <button
                onClick={dismiss}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
              >
                لاحقاً
              </button>
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="إغلاق"
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-secondary transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
