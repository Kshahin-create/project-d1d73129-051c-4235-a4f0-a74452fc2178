import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Building2, MapPin, Sparkles, Wrench, Cog, ZoomIn, X, Navigation } from "lucide-react";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PROJECT, LOCATION } from "@/lib/config";
import masterPlan from "@/assets/master-plan.png";
import heroBg from "@/assets/hero-bg.jpg";
import overviewBg from "@/assets/overview-city.png";
import landSpaces from "@/assets/land-spaces.png";
import { useBuildingsAndUnits } from "@/hooks/useBuildings";

const Index = () => {
  const { data } = useBuildingsAndUnits();
  const buildings = data?.buildings ?? [];
  const totalUnits = buildings.reduce((s, b) => s + b.totalUnits, 0);
  const availableUnits = buildings.reduce((s, b) => s + b.availableUnits, 0);
  const [zoomed, setZoomed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="h-full w-full object-cover" width={1920} height={1080} />
          <div className="absolute inset-0 bg-gradient-to-l from-primary/95 via-primary/90 to-primary/70" />
        </div>

        <div className="container-tight relative py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl text-primary-foreground"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              فرصة استثمارية — احجز وحدتك الآن
            </div>

            <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight text-balance sm:text-5xl">
              {PROJECT.nameAr}
            </h1>
            <p className="mt-2 font-display text-lg text-accent sm:text-xl" dir="ltr">
              {PROJECT.nameEn}
            </p>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-primary-foreground/85 sm:text-lg">
              مشروع متكامل يضمّ <strong className="text-accent">مراكز صيانة سيارات</strong> و
              <strong className="text-accent"> محلات قطع غيار وبناشر</strong>. احجز وحدتك في دقائق
              عبر نموذج ذكي يربطك مباشرة بإدارة المشروع.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/booking"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-6 py-3.5 font-display text-base font-bold text-accent-foreground shadow-gold transition-transform hover:scale-[1.02]"
              >
                ابدأ الحجز الآن
                <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
              </Link>
              <a
                href="#overview"
                className="inline-flex items-center gap-2 rounded-xl border border-primary-foreground/25 bg-primary-foreground/5 px-6 py-3.5 font-medium text-primary-foreground backdrop-blur-sm transition hover:bg-primary-foreground/15"
              >
                نظرة على المشروع
              </a>
            </div>

            {/* Stats */}
            <div className="mt-10 grid max-w-lg grid-cols-3 gap-3 sm:gap-6">
              <Stat value={10} label="مباني" />
              <Stat value={totalUnits} label="إجمالي الوحدات" />
              <Stat value={availableUnits} label="وحدة متاحة" accent />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Overview + Master plan */}
      <section id="overview" className="relative overflow-hidden py-12 sm:py-20">
        <div className="absolute inset-0 -z-10">
          <img src={overviewBg} alt="" className="h-full w-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-background/92 sm:bg-background/85 backdrop-blur-[3px]" />
        </div>
        <div className="container-tight grid items-start gap-8 sm:gap-10 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl bg-background/70 p-4 backdrop-blur-sm sm:bg-transparent sm:p-0 sm:backdrop-blur-0"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold text-accent-foreground sm:text-xs">
              <MapPin className="h-3.5 w-3.5" />
              شمال مكة المكرمة
            </div>
            <h2 className="mt-4 font-display text-2xl font-extrabold leading-tight sm:text-4xl">
              موقع استراتيجي لأنشطتك التجارية
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base sm:leading-relaxed">
              تضم <strong className="text-foreground">المرحلة الأولى</strong> للتأجير المبكر من المشروع
              {" "}<strong className="text-foreground">10 مبانٍ</strong> مصمّمة خصيصاً لقطاع صيانة السيارات
              وقطع الغيار. كل وحدة <strong className="text-foreground">جاهزة للتشغيل</strong> بمواصفات عالية
              وتسهيلات تشغيلية، بجوار <strong className="text-foreground">محطة الفحص الفني الدوري</strong>،
              تشغيل من أول يوم عمل.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Feature icon={<Wrench className="h-5 w-5" />} title="مراكز صيانة" desc="مباني 1-6 (144 وحدة)" to="/booking?activity=service" />
              <Feature icon={<Cog className="h-5 w-5" />} title="قطع غيار وبناشر" desc="مباني 7-10 (84 وحدة)" to="/booking?activity=parts" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-elevated"
          >
            <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-bold">
                <MapPin className="h-4 w-4 text-accent" />
                الماستر بلان الشامل
              </div>
              <button
                onClick={() => setZoomed(true)}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-medium text-primary-foreground transition hover:bg-primary/90"
              >
                <ZoomIn className="h-3 w-3" /> تكبير
              </button>
            </div>
            <button
              type="button"
              onClick={() => setZoomed(true)}
              className="block w-full cursor-zoom-in"
              aria-label="تكبير الماستر بلان"
            >
              <img
                src={masterPlan}
                alt="الماستر بلان الشامل للمدينة الصناعية بشمال مكة المكرمة"
                className="w-full bg-secondary object-contain"
                width={1536}
                height={2048}
                loading="lazy"
              />
            </button>
          </motion.div>
        </div>

        <div className="container-tight">
          {/* Lightbox */}
          <AnimatePresence>
            {zoomed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setZoomed(false)}
                className="fixed inset-0 z-50 flex items-center justify-center bg-primary/95 p-4 backdrop-blur-sm"
              >
                <button
                  onClick={() => setZoomed(false)}
                  className="absolute left-4 top-4 rounded-full bg-background/10 p-2 text-primary-foreground hover:bg-background/20"
                  aria-label="إغلاق"
                >
                  <X className="h-5 w-5" />
                </button>
                <motion.img
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  src={masterPlan}
                  alt="الماستر بلان الشامل"
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-full max-w-full rounded-xl object-contain shadow-elevated"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Land spaces visual banner — مساحات مرنة */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mt-16 overflow-hidden rounded-2xl border border-border bg-card shadow-elevated"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/50 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Building2 className="h-4 w-4 text-accent" />
                مساحات مرنة لأنشطة متعددة
              </div>
              <span className="text-xs text-muted-foreground">أرض المشروع</span>
            </div>
            <img
              src={landSpaces}
              alt="مساحات مرنة بأرض المشروع — ورش سيارات ومحلات قطع غيار ومحطة فحص فني دوري"
              className="w-full object-cover"
              loading="lazy"
            />
          </motion.div>

          {/* Project location on map */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-16 overflow-hidden rounded-2xl border border-border bg-card shadow-elevated"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/50 px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-bold">
                <MapPin className="h-4 w-4 text-accent" />
                موقع المشروع على الخريطة
              </div>
              <a
                href={LOCATION.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
              >
                <Navigation className="h-3.5 w-3.5" />
                فتح في خرائط جوجل
              </a>
            </div>
            <div className="px-5 pt-4 text-sm text-muted-foreground">
              <span className="font-bold text-foreground">العنوان:</span> {LOCATION.addressAr}
            </div>
            <div className="p-4">
              <div className="aspect-[16/10] w-full overflow-hidden rounded-xl border border-border sm:aspect-[16/9]">
                <iframe
                  src={LOCATION.embedUrl}
                  title="موقع المشروع على خرائط جوجل"
                  className="h-full w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </div>
          </motion.div>

          <div className="mt-16 flex flex-col items-center gap-5 rounded-2xl bg-gradient-hero p-8 text-center text-primary-foreground shadow-elevated sm:p-12">
            <h3 className="font-display text-2xl font-bold sm:text-3xl">جاهز لحجز وحدتك؟</h3>
            <p className="max-w-xl text-primary-foreground/80">
              أكمل خطوات الحجز بسهولة واستقبل التأكيد مباشرة عبر واتساب.
            </p>
            <Link
              to="/booking"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-6 py-3 font-display font-bold text-accent-foreground shadow-gold transition-transform hover:scale-105"
            >
              ابدأ الآن
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

const Stat = ({ value, label, accent }: { value: number; label: string; accent?: boolean }) => (
  <div className={`rounded-xl border p-3 backdrop-blur-sm sm:p-4 ${accent ? "border-accent/40 bg-accent/10" : "border-primary-foreground/15 bg-primary-foreground/5"}`}>
    <div className={`font-display text-2xl font-extrabold num sm:text-3xl ${accent ? "text-accent" : "text-primary-foreground"}`}>
      {value}
    </div>
    <div className="text-[11px] text-primary-foreground/75 sm:text-xs">{label}</div>
  </div>
);

const Feature = ({ icon, title, desc, to }: { icon: React.ReactNode; title: string; desc: string; to?: string }) => {
  const content = (
    <>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-foreground">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
        {to && (
          <div className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-accent">
            اختر هذا النشاط
            <ArrowLeft className="h-3.5 w-3.5" />
          </div>
        )}
      </div>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-card"
      >
        {content}
      </Link>
    );
  }

  return <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">{content}</div>;
};

export default Index;
