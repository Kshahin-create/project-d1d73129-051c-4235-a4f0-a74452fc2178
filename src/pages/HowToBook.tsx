import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  UserPlus,
  KeyRound,
  ShieldCheck,
  Building2,
  ClipboardList,
  CheckCircle2,
  Home,
  LogIn,
  MailCheck,
  PhoneCall,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

type Slide = {
  step: string;
  title: string;
  desc: string;
  bullets: string[];
  Icon: React.ComponentType<{ className?: string }>;
};

const slides: Slide[] = [
  {
    step: "مرحبًا بك",
    title: "دليلك السريع للتسجيل وحجز وحدة",
    desc: "خطوات بسيطة وواضحة لإنشاء حسابك وحجز وحدتك في المشروع خلال دقائق.",
    bullets: [
      "شرح تفصيلي لكل خطوة",
      "مناسب للحاسب واللابتوب",
      "يمكنك التنقل بالأسهم في لوحة المفاتيح",
    ],
    Icon: Home,
  },
  {
    step: "الخطوة 1",
    title: "افتح صفحة تسجيل الدخول",
    desc: "اضغط زر «دخول» من أعلى الصفحة الرئيسية للانتقال إلى صفحة الحساب.",
    bullets: [
      "ستجد زر «دخول» في رأس الصفحة",
      "أو افتح الرابط /auth مباشرة",
      "تستطيع إنشاء حساب جديد أو الدخول بحساب موجود",
    ],
    Icon: LogIn,
  },
  {
    step: "الخطوة 2",
    title: "أنشئ حسابًا جديدًا",
    desc: "اختر تبويب «إنشاء حساب» وأدخل بياناتك الأساسية.",
    bullets: [
      "الاسم الكامل كما في الهوية",
      "البريد الإلكتروني (سيُستخدم للتواصل والتأكيد)",
      "كلمة مرور قوية لا تقل عن 8 أحرف",
      "رقم جوال سعودي للتفعيل",
    ],
    Icon: UserPlus,
  },
  {
    step: "الخطوة 3",
    title: "تأكيد البريد الإلكتروني",
    desc: "ستصلك رسالة على بريدك تحتوي على رابط التفعيل، اضغط عليه لتفعيل الحساب.",
    bullets: [
      "افحص صندوق الوارد وكذلك مجلد الـ Spam",
      "الرابط صالح لفترة محدودة",
      "بعد التفعيل يمكنك تسجيل الدخول مباشرة",
    ],
    Icon: MailCheck,
  },
  {
    step: "الخطوة 4",
    title: "تأمين الحساب (اختياري)",
    desc: "ننصح بتفعيل التحقق بخطوتين لحماية حسابك من أي وصول غير مصرح به.",
    bullets: [
      "افتح صفحة الملف الشخصي /profile",
      "فعّل التحقق بخطوتين عبر تطبيق Google Authenticator",
      "احتفظ برقم جوالك محدثًا للاسترداد عبر SMS",
    ],
    Icon: ShieldCheck,
  },
  {
    step: "الخطوة 5",
    title: "تصفح المباني والوحدات",
    desc: "من الصفحة الرئيسية اضغط «ابدأ الحجز الآن» لاستعراض المباني المتاحة.",
    bullets: [
      "كل مبنى يعرض عدد الوحدات المتاحة",
      "اضغط على الوحدة لعرض تفاصيلها",
      "تستطيع رؤية المساحة والسعر والمواصفات",
    ],
    Icon: Building2,
  },
  {
    step: "الخطوة 6",
    title: "اختر الوحدة المناسبة",
    desc: "حدّد الوحدة التي تناسب نشاطك التجاري وتأكد من تفاصيلها قبل المتابعة.",
    bullets: [
      "راجع المساحة والموقع داخل المخطط",
      "تأكد من توفر الخدمات المطلوبة",
      "اضغط «حجز هذه الوحدة» للمتابعة",
    ],
    Icon: KeyRound,
  },
  {
    step: "الخطوة 7",
    title: "أكمل بيانات الحجز",
    desc: "املأ نموذج الحجز ببيانات المستأجر ونوع النشاط التجاري.",
    bullets: [
      "اسم المستأجر / المنشأة",
      "رقم السجل التجاري إن وُجد",
      "نوع النشاط ومدة العقد المطلوبة",
      "ملاحظات إضافية (اختياري)",
    ],
    Icon: ClipboardList,
  },
  {
    step: "الخطوة 8",
    title: "تأكيد الطلب وإرساله",
    desc: "راجع بياناتك ثم أرسل الطلب ليصل مباشرة إلى مدير التشغيل والتأجير.",
    bullets: [
      "ستحصل على رقم مرجعي للحجز",
      "نسخة من العرض ترسل لبريدك",
      "يتواصل معك الفريق خلال ساعات العمل",
    ],
    Icon: CheckCircle2,
  },
  {
    step: "الخطوة 9",
    title: "المتابعة عبر الواتساب",
    desc: "بعد إرسال الطلب يمكنك متابعة حجزك مع الفريق مباشرة عبر الواتساب.",
    bullets: [
      "يصلك تأكيد عبر واتساب",
      "اتفاق على موعد التوقيع والمعاينة",
      "إنهاء العقد واستلام الوحدة",
    ],
    Icon: PhoneCall,
  },
];

const HowToBook = () => {
  const [index, setIndex] = useState(0);

  const next = () => setIndex((i) => Math.min(slides.length - 1, i + 1));
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") next();
      else if (e.key === "ArrowRight") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const slide = slides[index];
  const { Icon } = slide;
  const progress = ((index + 1) / slides.length) * 100;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="container-tight py-8 sm:py-12">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[11px] font-bold text-accent-foreground">
                دليل تفاعلي
              </div>
              <h1 className="mt-3 font-display text-2xl font-extrabold sm:text-4xl">
                كيف أسجّل وأحجز وحدة؟
              </h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                اضغط الأسهم أو استخدم لوحة المفاتيح للتنقل بين الشرائح.
              </p>
            </div>
            <Link
              to="/booking"
              className="hidden shrink-0 items-center gap-2 rounded-xl bg-gradient-gold px-5 py-3 font-display text-sm font-bold text-accent-foreground shadow-gold transition-transform hover:scale-[1.02] sm:inline-flex"
            >
              ابدأ الحجز الآن
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>

          {/* Progress */}
          <div className="mb-6 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="num shrink-0 text-xs font-bold text-muted-foreground">
              {index + 1} / {slides.length}
            </span>
          </div>

          {/* Slide */}
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-background shadow-xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="grid min-h-[460px] gap-8 p-6 sm:p-12 lg:grid-cols-[1fr_auto] lg:gap-14"
              >
                <div className="flex flex-col justify-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-accent">
                    {slide.step}
                  </span>
                  <h2 className="mt-3 font-display text-2xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
                    {slide.title}
                  </h2>
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                    {slide.desc}
                  </p>
                  <ul className="mt-6 space-y-3">
                    {slide.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-3 text-sm sm:text-base">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                        <span className="text-foreground/90">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center justify-center">
                  <div className="relative flex h-44 w-44 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-accent/20 sm:h-64 sm:w-64">
                    <div className="absolute inset-3 rounded-full border border-dashed border-accent/40" />
                    <Icon className="h-20 w-20 text-primary sm:h-28 sm:w-28" />
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Controls */}
            <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3 sm:px-6">
              <button
                onClick={prev}
                disabled={index === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowRight className="h-4 w-4" />
                السابق
              </button>

              <div className="flex items-center gap-1.5">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    aria-label={`الشريحة ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      i === index ? "w-6 bg-primary" : "w-2 bg-border hover:bg-muted-foreground/40"
                    }`}
                  />
                ))}
              </div>

              {index < slides.length - 1 ? (
                <button
                  onClick={next}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90"
                >
                  التالي
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <Link
                  to="/booking"
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-gold px-4 py-2 text-sm font-bold text-accent-foreground shadow-gold transition hover:opacity-95"
                >
                  ابدأ الحجز
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HowToBook;
