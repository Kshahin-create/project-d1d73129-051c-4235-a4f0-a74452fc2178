import { AlertTriangle, CalendarClock, FileSignature, Combine, Wallet, Briefcase } from "lucide-react";

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

export const TenantNotice = () => {
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-50 to-amber-100/50 shadow-lg dark:from-amber-950/30 dark:to-amber-900/10">
      <div className="flex items-center gap-2 border-b-2 border-amber-500/30 bg-amber-500/10 px-5 py-3">
        <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-400" />
        <h2 className="font-display text-base font-extrabold text-amber-900 dark:text-amber-200 sm:text-lg">
          تحديثات هامة للمستأجرين — المرحلة الأولى
        </h2>
      </div>
      <ul className="grid gap-3 p-4 sm:p-5 md:grid-cols-2">
        {items.map(({ Icon, title, text }, i) => (
          <li
            key={i}
            className="flex gap-3 rounded-xl border border-amber-500/20 bg-card/80 p-3 shadow-sm backdrop-blur"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="mb-1 text-sm font-bold text-foreground">{title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
