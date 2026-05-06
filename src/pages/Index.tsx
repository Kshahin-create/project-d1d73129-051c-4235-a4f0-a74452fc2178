import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MapPin, Wrench, Cog, ZoomIn, X, Navigation, ArrowUpLeft } from "lucide-react";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PROJECT, LOCATION } from "@/lib/config";
import masterPlan from "@/assets/master-plan.png";
import heroBg from "@/assets/hero-bg.jpg";
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

      {/* ============== HERO — minimal, large typography ============== */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="container-tight relative grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-12 lg:gap-12 lg:py-32">
          {/* Left: text */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              فرصة استثمارية — المرحلة الأولى
            </div>

            <h1 className="mt-6 font-display text-[2.5rem] font-extrabold leading-[1.05] tracking-tight text-foreground text-balance sm:text-6xl lg:text-7xl">
              {PROJECT.nameAr}
              <span className="mt-3 block font-display text-base font-medium text-muted-foreground sm:text-lg" dir="ltr">
                {PROJECT.nameEn}
              </span>
            </h1>

            <p className="mt-8 max-w-xl text-base leading-loose text-muted-foreground sm:text-lg">
              مشروع متكامل لمراكز صيانة السيارات ومحلات قطع الغيار والبناشر.
              احجز وحدتك في دقائق عبر نموذج ذكي يربطك بإدارة المشروع مباشرة.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                to="/booking"
                className="group inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-bold text-background transition hover:opacity-90"
              >
                ابدأ الحجز
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              </Link>
              <a
                href="#overview"
                className="inline-flex items-center gap-2 rounded-full px-5 py-3.5 text-sm font-medium text-foreground transition hover:text-accent"
              >
                نظرة على المشروع
                <ArrowUpLeft className="h-4 w-4" />
              </a>
            </div>
          </motion.div>

          {/* Right: hero image card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative lg:col-span-5"
          >
            <div className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-card">
              <img src={heroBg} alt="" className="aspect-[4/5] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/85 via-foreground/30 to-transparent p-5 text-background">
                <div className="text-[11px] font-medium uppercase tracking-widest opacity-80">شمال مكة المكرمة</div>
                <div className="mt-1 font-display text-lg font-bold">10 مبانٍ • {totalUnits} وحدة</div>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 hidden rounded-2xl border border-border bg-background p-4 shadow-elevated sm:block">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">متاح الآن</div>
              <div className="mt-1 font-display text-3xl font-extrabold text-accent num">{availableUnits}</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============== STATS strip ============== */}
      <section className="border-b border-border/60 bg-card/40">
        <div className="container-tight grid grid-cols-3 divide-x divide-border/60 [direction:ltr] py-10 sm:py-14">
          <StatMinimal value={10} label="مبانٍ" />
          <StatMinimal value={totalUnits} label="إجمالي الوحدات" />
          <StatMinimal value={availableUnits} label="متاحة للحجز" highlight />
        </div>
      </section>

      {/* ============== OVERVIEW ============== */}
      <section id="overview" className="py-20 sm:py-32">
        <div className="container-tight">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">المشروع</div>
            <h2 className="mt-4 font-display text-4xl font-extrabold leading-tight tracking-tight text-balance sm:text-5xl">
              موقع استراتيجي مصمّم لأنشطتك التجارية
            </h2>
            <p className="mt-6 text-base leading-loose text-muted-foreground sm:text-lg">
              تضم المرحلة الأولى <strong className="text-foreground">10 مبانٍ</strong> مصمّمة خصيصاً لقطاع
              صيانة السيارات وقطع الغيار. كل وحدة جاهزة للتشغيل من أول يوم،
              بجوار محطة الفحص الفني الدوري.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2 sm:gap-6">
            <FeatureCard
              icon={<Wrench className="h-5 w-5" />}
              title="مراكز صيانة"
              desc="مباني 1-6 • 144 وحدة"
              to="/booking?activity=service"
            />
            <FeatureCard
              icon={<Cog className="h-5 w-5" />}
              title="قطع غيار وبناشر"
              desc="مباني 7-10 • 84 وحدة"
              to="/booking?activity=parts"
            />
          </div>
        </div>
      </section>

      {/* ============== MASTER PLAN ============== */}
      <section className="border-y border-border/60 bg-card/40 py-20 sm:py-28">
        <div className="container-tight grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">الماستر بلان</div>
            <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              نظرة شاملة على المخطط
            </h2>
            <p className="mt-5 text-base leading-loose text-muted-foreground">
              تخطيط متكامل يجمع ورش السيارات ومحلات قطع الغيار والبناشر في موقع واحد،
              مع سهولة الحركة والوصول لكل وحدة.
            </p>
            <button
              onClick={() => setZoomed(true)}
              className="mt-7 inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium transition hover:border-foreground"
            >
              <ZoomIn className="h-4 w-4" /> عرض المخطط بحجم كامل
            </button>
          </div>
          <button
            type="button"
            onClick={() => setZoomed(true)}
            className="group block overflow-hidden rounded-3xl border border-border bg-background shadow-card transition hover:shadow-elevated"
            aria-label="تكبير الماستر بلان"
          >
            <img
              src={masterPlan}
              alt="الماستر بلان الشامل"
              className="w-full object-contain transition-transform duration-700 group-hover:scale-[1.02]"
              loading="lazy"
            />
          </button>
        </div>
      </section>

      {/* Lightbox */}
      <AnimatePresence>
        {zoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomed(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/95 p-4 backdrop-blur-sm"
          >
            <button
              onClick={() => setZoomed(false)}
              className="absolute left-4 top-4 rounded-full bg-background/10 p-2 text-background hover:bg-background/20"
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
              className="max-h-full max-w-full rounded-xl object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============== LAND SPACES ============== */}
      <section className="py-20 sm:py-28">
        <div className="container-tight">
          <div className="mx-auto max-w-2xl text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">المساحات</div>
            <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              مساحات مرنة لأنشطة متعددة
            </h2>
          </div>
          <div className="mt-12 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
            <img
              src={landSpaces}
              alt="مساحات مرنة بأرض المشروع"
              className="w-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ============== LOCATION ============== */}
      <section className="border-t border-border/60 bg-card/40 py-20 sm:py-28">
        <div className="container-tight">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">الموقع</div>
              <h2 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                على الخريطة
              </h2>
              <p className="mt-3 max-w-md text-sm leading-loose text-muted-foreground">
                <span className="font-bold text-foreground">العنوان:</span> {LOCATION.addressAr}
              </p>
            </div>
            <a
              href={LOCATION.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background transition hover:opacity-90"
            >
              <Navigation className="h-4 w-4" /> فتح في خرائط جوجل
            </a>
          </div>
          <div className="mt-10 overflow-hidden rounded-3xl border border-border shadow-card">
            <div className="aspect-[16/10] w-full sm:aspect-[16/8]">
              <iframe
                src={LOCATION.embedUrl}
                title="موقع المشروع"
                className="h-full w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>

      {/* ============== CTA ============== */}
      <section className="py-20 sm:py-28">
        <div className="container-tight">
          <div className="relative overflow-hidden rounded-[2rem] border border-border bg-foreground px-8 py-16 text-center text-background sm:px-16 sm:py-24">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
            <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-primary-glow/20 blur-3xl" />
            <div className="relative">
              <h3 className="mx-auto max-w-2xl font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                جاهز لحجز وحدتك؟
              </h3>
              <p className="mx-auto mt-5 max-w-md text-sm text-background/70 sm:text-base">
                أكمل خطوات الحجز بسهولة واستقبل التأكيد عبر واتساب.
              </p>
              <Link
                to="/booking"
                className="mt-9 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-4 font-display text-base font-bold text-accent-foreground transition hover:scale-[1.02]"
              >
                ابدأ الآن
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

const StatMinimal = ({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) => (
  <div className="px-4 text-center [direction:rtl]">
    <div className={`font-display text-4xl font-extrabold tracking-tight num sm:text-5xl ${highlight ? "text-accent" : "text-foreground"}`}>
      {value}
    </div>
    <div className="mt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
  </div>
);

const FeatureCard = ({ icon, title, desc, to }: { icon: React.ReactNode; title: string; desc: string; to: string }) => (
  <Link
    to={to}
    className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-card"
  >
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
      {icon}
    </div>
    <div className="flex-1">
      <div className="font-display text-base font-bold">{title}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
    </div>
    <ArrowLeft className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:text-foreground" />
  </Link>
);

export default Index;
