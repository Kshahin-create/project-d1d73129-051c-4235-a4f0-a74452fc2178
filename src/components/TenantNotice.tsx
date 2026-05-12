import { AlertTriangle, CalendarClock, FileSignature, Combine, Wallet, Briefcase, ArrowLeft, ShieldCheck } from "lucide-react";

const items = [
  {
    Icon: CalendarClock,
    title: "الجدول الزمني للإنجاز",
    text: "انطلاق العمليات الإنشائية في الموقع ابتداءً من 20 ذو الحجة، مع التزامنا التام بتسليم الوحدات جاهزة للتشغيل الفوري في مدة قياسية تتراوح بين 4 إلى 6 أشهر.",
  },
  {
    Icon: FileSignature,
    title: "نظام التأجير المبكر",
    text: "العقود المتاحة حالياً هي عقود \"تأجير مبكر\" لضمان حقوق المستأجرين في أولوية التسكين والبدء الفوري فور اكتمال البناء، وليست مجرد حجز مبدئي.",
  },
  {
    Icon: Combine,
    title: "مرونة المساحات (إمكانية الدمج)",
    text: "نوفر حلولاً هندسية مرنة تتيح للمستأجر دمج أكثر من وحدة متجاورة لفتح مساحات كبرى تتناسب مع احتياجات النشاط، لضمان تلبية تطلعاتكم التوسعية.",
  },
  {
    Icon: Wallet,
    title: "تأكيد الجدية والسداد",
    text: "يلتزم المستأجر بتحويل القيمة الإيجارية خلال 48 ساعة من اختيار الوحدة؛ وفي حال التأخر، سيتم إلغاء الحجز تلقائياً لإتاحة الفرصة لمستأجر آخر.",
  },
  {
    Icon: Briefcase,
    title: "تخصص النشاط التشغيلي",
    text: "حرصاً على تنوع الخدمات وتكاملها داخل المدينة الصناعية، يلتزم المستأجر بتشغيل النشاط المحدد في عرض التأجير حصراً.",
  },
];

export const TenantNoticeScreen = ({ onContinue }: { onContinue: () => void }) => {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-50 to-amber-100/40 shadow-xl dark:from-amber-950/30 dark:to-amber-900/10">
        {/* Header */}
        <div className="border-b-2 border-amber-500/30 bg-amber-500/10 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 sm:h-11 sm:w-11">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-base font-extrabold leading-tight text-amber-900 dark:text-amber-200 sm:text-xl">
                تحديثات هامة للمستأجرين
              </h1>
              <p className="mt-0.5 text-xs font-semibold text-amber-800/80 dark:text-amber-300/80 sm:text-sm">
                المرحلة الأولى — يرجى قراءتها قبل المتابعة
              </p>
            </div>
          </div>
        </div>

        {/* Items */}
        <ul className="space-y-2.5 p-3 sm:space-y-3 sm:p-5">
          {items.map(({ Icon, title, text }, i) => (
            <li
              key={i}
              className="flex gap-2.5 rounded-xl border border-amber-500/20 bg-card/90 p-3 shadow-sm backdrop-blur sm:gap-3 sm:p-4"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 sm:h-10 sm:w-10">
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="mb-1 text-[13px] font-bold leading-snug text-foreground sm:text-sm">
                  <span className="ml-1 text-amber-700 dark:text-amber-400">{i + 1}.</span> {title}
                </h3>
                <p className="text-[12px] leading-relaxed text-muted-foreground sm:text-[13px]">
                  {text}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* Footer / CTA */}
        <div className="border-t-2 border-amber-500/30 bg-amber-500/5 px-4 py-4 sm:px-6 sm:py-5">
          <div className="mb-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground sm:text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>بالضغط على متابعة فإنك تقرّ بالاطلاع على الشروط أعلاه</span>
          </div>
          <button
            onClick={onContinue}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-amber-600 to-amber-500 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-500/30 transition hover:from-amber-700 hover:to-amber-600 active:scale-[0.98] sm:text-base"
          >
            قرأت ووافقت — متابعة الحجز
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
