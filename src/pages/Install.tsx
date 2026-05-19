import { useEffect, useState } from "react";
import { Smartphone, Share, Plus, Download, Apple, Check, MoreVertical } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/logo-nukhbat.png";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const detectPlatform = (): "ios" | "android" | "desktop" => {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
};

const Install = () => {
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    setInstalled(standalone);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      toast({ title: "تم التثبيت بنجاح ✅", description: "افتح التطبيق من شاشة هاتفك." });
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) {
      toast({
        title: "اتبع الخطوات اليدوية",
        description: "افتح قائمة المتصفح واختر «إضافة إلى الشاشة الرئيسية».",
      });
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setDeferred(null);
    }
  };

  const handleShare = async () => {
    const url = window.location.origin + "/install";
    const shareData = {
      title: "نخبة تسكين العقارية",
      text: "نزّل الموقع كتطبيق على هاتفك",
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "تم نسخ الرابط ✅", description: url });
      }
    } catch {
      /* user cancelled */
    }
  };

  useEffect(() => {
    document.title = "تثبيت التطبيق على هاتفك | نخبة تسكين العقارية";
  }, []);

  return (
    <>

      <div className="min-h-screen bg-background flex flex-col">
        <Header />

        <main className="flex-1">
          <section className="container-tight px-4 py-10">
            <div className="mx-auto max-w-2xl">
              <div className="text-center">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-card shadow-card border border-border/60">
                  <img src={logo} alt="شعار نخبة تسكين" className="h-14 w-auto object-contain" />
                </div>
                <h1 className="mt-5 font-display text-3xl font-bold text-foreground sm:text-4xl">
                  نزّل التطبيق على هاتفك
                </h1>
                <p className="mt-3 text-muted-foreground text-balance">
                  استمتع بتجربة أسرع وأسهل — اضف موقع نخبة تسكين كأيقونة على شاشة هاتفك
                  وافتحه بضغطة واحدة كأنه تطبيق حقيقي.
                </p>
              </div>

              {installed && (
                <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-success">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">التطبيق مثبت بالفعل على هذا الجهاز.</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {platform === "android" || platform === "desktop" ? (
                  <Button
                    size="lg"
                    onClick={handleInstall}
                    className="h-14 text-base font-bold"
                    disabled={installed}
                  >
                    <Download className="ml-2 h-5 w-5" />
                    {deferred ? "تثبيت التطبيق الآن" : "تثبيت التطبيق"}
                  </Button>
                ) : (
                  <Button size="lg" className="h-14 text-base font-bold" disabled>
                    <Apple className="ml-2 h-5 w-5" />
                    اتبع خطوات الآيفون أدناه
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleShare}
                  className="h-14 text-base font-bold"
                >
                  <Share className="ml-2 h-5 w-5" />
                  مشاركة رابط التثبيت
                </Button>
              </div>

              {/* iOS instructions */}
              <div className="mt-10 rounded-2xl border border-border bg-card shadow-card overflow-hidden">
                <div className="flex items-center gap-3 border-b border-border/60 bg-secondary px-5 py-4">
                  <Apple className="h-6 w-6 text-foreground" />
                  <h2 className="font-bold text-foreground text-lg">على الآيفون / آيباد (Safari)</h2>
                </div>
                <ol className="space-y-4 px-5 py-5 text-sm leading-relaxed text-foreground">
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold num">1</span>
                    <span>افتح الموقع داخل متصفح <strong>Safari</strong> (وليس داخل تطبيق آخر).</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold num">2</span>
                    <span className="flex flex-wrap items-center gap-1">
                      اضغط على زر المشاركة
                      <Share className="inline h-4 w-4 text-primary" />
                      في أسفل الشاشة.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold num">3</span>
                    <span className="flex flex-wrap items-center gap-1">
                      اختر <strong>«إضافة إلى الشاشة الرئيسية»</strong>
                      <Plus className="inline h-4 w-4 text-primary" />.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold num">4</span>
                    <span>اضغط <strong>«إضافة»</strong> — ستظهر أيقونة التطبيق على شاشتك.</span>
                  </li>
                </ol>
              </div>

              {/* Android instructions */}
              <div className="mt-5 rounded-2xl border border-border bg-card shadow-card overflow-hidden">
                <div className="flex items-center gap-3 border-b border-border/60 bg-secondary px-5 py-4">
                  <Smartphone className="h-6 w-6 text-foreground" />
                  <h2 className="font-bold text-foreground text-lg">على الأندرويد (Chrome)</h2>
                </div>
                <ol className="space-y-4 px-5 py-5 text-sm leading-relaxed text-foreground">
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold num">1</span>
                    <span>اضغط زر <strong>«تثبيت التطبيق»</strong> بالأعلى إذا ظهر لك.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold num">2</span>
                    <span className="flex flex-wrap items-center gap-1">
                      أو افتح قائمة المتصفح
                      <MoreVertical className="inline h-4 w-4 text-primary" />
                      في الأعلى.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold num">3</span>
                    <span>
                      اختر <strong>«تثبيت التطبيق»</strong> أو <strong>«إضافة إلى الشاشة الرئيسية»</strong>.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold num">4</span>
                    <span>أكّد التثبيت — ستجد التطبيق ضمن تطبيقاتك.</span>
                  </li>
                </ol>
              </div>

              <div className="mt-8 rounded-xl bg-accent-soft px-5 py-4 text-sm text-accent-foreground">
                💡 شارك هذا الرابط مع أي شخص تريد أن يثبّت التطبيق على هاتفه:
                <div className="mt-2 select-all font-mono text-xs num bg-card border border-border rounded-lg px-3 py-2 break-all">
                  {typeof window !== "undefined" ? window.location.origin + "/install" : "/install"}
                </div>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default Install;
