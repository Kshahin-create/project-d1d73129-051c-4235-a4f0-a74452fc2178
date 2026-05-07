import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  MousePointerClick,
  Smartphone,
  ShieldCheck,
  KeyRound,
  Building2,
  LayoutGrid,
  CheckSquare,
  ClipboardList,
  Send,
  PartyPopper,
  ArrowLeft,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

type Slide = {
  step: string;
  title: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
  cta?: { label: string; to: string };
};

const slides: Slide[] = [
  {
    step: "01",
    title: "ابدأ حجز وحدتك الآن",
    desc: "لبدء عملية الحجز، اضغط على زر «ابدأ الحجز الآن» من الصفحة الرئيسية للموقع.",
    Icon: MousePointerClick,
  },
  {
    step: "02",
    title: "تسجيل الدخول برقم الجوال",
    desc: "سيتم تحويلك إلى صفحة تسجيل الدخول. أدخل رقم الجوال الخاص بك لاستكمال خطوات الحجز.",
    Icon: Smartphone,
  },
  {
    step: "03",
    title: "تأكيد رقم الجوال",
    desc: "سيصلك رمز تحقق عبر رسالة SMS. أدخل الرمز في الخانة المخصصة لتأكيد رقم الجوال.",
    Icon: ShieldCheck,
  },
  {
    step: "04",
    title: "إنشاء كلمة مرور",
    desc: "بعد تأكيد الرقم، قم بإنشاء كلمة مرور خاصة بحسابك لاستخدامها في تسجيل الدخول لاحقًا.",
    Icon: KeyRound,
  },
  {
    step: "05",
    title: "اختيار نوع النشاط والمبنى",
    desc: "بعد الدخول إلى الحساب، اختر المبنى المناسب حسب نوع النشاط المطلوب، مثل: ورش، قطع غيار، مستودعات، أو أنشطة أخرى متاحة.",
    Icon: Building2,
  },
  {
    step: "06",
    title: "استعراض الوحدات المتاحة",
    desc: "ستظهر لك جميع الوحدات المتوفرة داخل المبنى الذي اخترته. راجع تفاصيل الوحدات واختر الوحدة المناسبة لك.",
    Icon: LayoutGrid,
  },
  {
    step: "07",
    title: "اختيار الوحدة والمتابعة",
    desc: "بعد اختيار الوحدة المناسبة، اضغط على زر «متابعة» للانتقال إلى مرحلة إدخال البيانات.",
    Icon: CheckSquare,
  },
  {
    step: "08",
    title: "إدخال البيانات المطلوبة",
    desc: "قم بتعبئة البيانات المطلوبة بدقة لاستكمال طلب الحجز.",
    Icon: ClipboardList,
  },
  {
    step: "09",
    title: "تأكيد التسجيل",
    desc: "بعد إدخال البيانات، اضغط على «تسجيل» لإرسال طلب الحجز بنجاح.",
    Icon: Send,
  },
  {
    step: "10",
    title: "تم إرسال طلبك بنجاح",
    desc: "سيتم مراجعة بياناتك والتواصل معك لاستكمال إجراءات الحجز. احجز وحدتك الآن في المدينة الصناعية بشمال مكة المكرمة.",
    Icon: PartyPopper,
    cta: { label: "ابدأ الحجز الآن", to: "/booking" },
  },
];

// In RTL: dragging right (positive x) means going to previous (logical "right"),
// dragging left (negative x) means going to next.
const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? -120 : 120, opacity: 0, scale: 0.96 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? 120 : -120, opacity: 0, scale: 0.96 }),
};

const HowToBook = () => {
  const [[index, dir], setState] = useState<[number, number]>([0, 1]);

  const go = (n: number) => {
    if (n < 0 || n >= slides.length) return;
    setState(([cur]) => [n, n > cur ? 1 : -1]);
  };
  const next = () => go(index + 1);
  const prev = () => go(index - 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // RTL: ArrowLeft moves forward, ArrowRight moves back
      if (e.key === "ArrowLeft") next();
      else if (e.key === "ArrowRight") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const threshold = 80;
    const power = info.offset.x + info.velocity.x * 0.25;
    if (power < -threshold) next();
    else if (power > threshold) prev();
  };

  const slide = slides[index];
  const { Icon } = slide;
  const progress = ((index + 1) / slides.length) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Decorative background */}
        <div className="pointer-events-none absolute inset-x-0 top-16 -z-0 h-[520px] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-accent/5 to-transparent" />
          <div className="absolute -top-32 right-1/4 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -top-24 left-1/4 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        </div>

        <section className="container-tight relative py-8 sm:py-12">
          <div className="mb-6 text-center sm:mb-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold text-accent-foreground">
              دليل تفاعلي
            </div>
            <h1 className="mt-3 font-display text-2xl font-extrabold sm:text-4xl">
              كيف أحجز وحدة في المدينة الصناعية؟
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              اسحب الشريحة يمينًا أو يسارًا للتنقل، أو استخدم أسهم لوحة المفاتيح.
            </p>
          </div>

          {/* Progress */}
          <div className="mx-auto mb-5 flex max-w-3xl items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-accent"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <span className="num shrink-0 text-xs font-bold text-muted-foreground">
              {index + 1} / {slides.length}
            </span>
          </div>

          {/* Slide deck */}
          <div className="relative mx-auto max-w-5xl">
            <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-background shadow-2xl">
              <AnimatePresence mode="wait" custom={dir}>
                <motion.div
                  key={index}
                  custom={dir}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={onDragEnd}
                  className="relative grid min-h-[440px] cursor-grab gap-8 p-6 active:cursor-grabbing sm:min-h-[520px] sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:gap-12"
                >
                  {/* Watermark step number */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -left-4 -top-6 select-none font-display text-[10rem] font-black leading-none text-primary/5 sm:text-[16rem]"
                  >
                    {slide.step}
                  </div>

                  <div className="relative z-10 flex flex-col justify-center">
                    <motion.span
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"
                    >
                      <span className="num">الخطوة {slide.step}</span>
                    </motion.span>
                    <motion.h2
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.4 }}
                      className="mt-4 font-display text-2xl font-extrabold leading-tight sm:text-4xl lg:text-5xl"
                    >
                      {slide.title}
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.22, duration: 0.4 }}
                      className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg sm:leading-loose"
                    >
                      {slide.desc}
                    </motion.p>

                    {slide.cta && (
                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.32, duration: 0.4 }}
                        className="mt-7"
                      >
                        <Link
                          to={slide.cta.to}
                          className="group inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-6 py-3.5 font-display text-base font-bold text-accent-foreground shadow-gold transition-transform hover:scale-[1.02]"
                        >
                          {slide.cta.label}
                          <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                        </Link>
                      </motion.div>
                    )}
                  </div>

                  <div className="relative z-10 flex items-center justify-center">
                    <motion.div
                      initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      transition={{ delay: 0.1, duration: 0.5, type: "spring", stiffness: 120 }}
                      className="relative flex h-52 w-52 items-center justify-center sm:h-72 sm:w-72"
                    >
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/15 to-accent/25 blur-2xl" />
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/10 to-accent/20" />
                      <motion.div
                        className="absolute inset-3 rounded-full border border-dashed border-accent/40"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
                      />
                      <div className="absolute inset-8 rounded-full bg-card shadow-inner" />
                      <Icon className="relative h-24 w-24 text-primary sm:h-32 sm:w-32" />
                    </motion.div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Dots */}
            <div className="mt-6 flex items-center justify-center gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  aria-label={`الشريحة ${i + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    i === index
                      ? "w-8 bg-primary"
                      : "w-2 bg-border hover:bg-muted-foreground/40"
                  }`}
                />
              ))}
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              اسحب الشريحة ← أو → للتنقل
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HowToBook;
