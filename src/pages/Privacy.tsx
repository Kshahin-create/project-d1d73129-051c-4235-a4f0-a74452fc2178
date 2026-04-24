import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { COMPANY, CONTACT } from "@/lib/config";

/**
 * صفحة سياسة الخصوصية والأمان
 * Privacy & Security Policy page
 */
const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container-tight py-10 sm:py-14">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          الرئيسية
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-soft text-accent-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-extrabold sm:text-4xl">سياسة الخصوصية والأمان</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              آخر تحديث: {new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>

        <article className="prose prose-slate mt-8 max-w-none rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          <Section title="مقدمة">
            تحرص <strong>{COMPANY.name}</strong> على حماية خصوصية زوّار وعملاء موقعها الإلكتروني، وتلتزم بأعلى معايير
            الأمان في التعامل مع بياناتك الشخصية. توضّح هذه السياسة كيفية جمع بياناتك واستخدامها وحمايتها.
          </Section>

          <Section title="البيانات التي نجمعها">
            <ul>
              <li><strong>البيانات الأساسية:</strong> الاسم الكامل، رقم الجوال، البريد الإلكتروني (اختياري).</li>
              <li><strong>بيانات النشاط التجاري:</strong> اسم المنشأة وطبيعة النشاط الذي ترغب بممارسته.</li>
              <li><strong>تفاصيل الطلب:</strong> رقم المبنى والوحدة المختارة وأي ملاحظات إضافية تقدّمها.</li>
              <li><strong>البيانات التقنية:</strong> نوع المتصفح والجهاز لأغراض تحسين تجربة الاستخدام فقط.</li>
            </ul>
          </Section>

          <Section title="كيف نستخدم بياناتك">
            <ul>
              <li>معالجة طلبات الحجز والتواصل معك لتأكيد التفاصيل.</li>
              <li>إرسال المعلومات اللازمة لإتمام عقد التأجير.</li>
              <li>تحسين خدماتنا وتجربة المستخدم على الموقع.</li>
              <li>الردّ على استفساراتك عبر قنوات التواصل المتاحة.</li>
            </ul>
          </Section>

          <Section title="مشاركة البيانات">
            لا نقوم ببيع أو تأجير أو مشاركة بياناتك الشخصية مع أي طرف ثالث لأغراض تسويقية. قد نشارك بياناتك فقط مع:
            <ul>
              <li>مالك المشروع والمستثمر لأغراض إتمام عقد التأجير.</li>
              <li>الجهات الرسمية عند طلبها قانونياً.</li>
            </ul>
          </Section>

          <Section title="تأمين البيانات">
            نطبّق إجراءات تقنية وتنظيمية صارمة لحماية بياناتك من الوصول غير المصرّح به أو الفقد أو التعديل، تشمل:
            <ul>
              <li>تشفير الاتصال عبر بروتوكول HTTPS.</li>
              <li>تقييد الوصول للبيانات على الموظفين المخوّلين فقط.</li>
              <li>المراجعة الدورية لإجراءات الأمان.</li>
            </ul>
          </Section>

          <Section title="استخدام واتساب">
            عند إرسال طلب الحجز عبر واتساب، يتم نقل بياناتك مباشرة من جهازك إلى منصّة واتساب وفقاً لسياسة خصوصيتها.
            نحن لا نخزّن نسخة من المحادثة على خوادمنا.
          </Section>

          <Section title="ملفات تعريف الارتباط (Cookies)">
            يستخدم الموقع ملفات تعريف ارتباط أساسية لضمان عمل الموقع بشكل صحيح فقط. لا نستخدم ملفات تتبّع أو تحليلات
            لأغراض تسويقية بدون موافقتك.
          </Section>

          <Section title="حقوقك">
            <ul>
              <li>طلب الاطلاع على بياناتك الشخصية المخزّنة لدينا.</li>
              <li>طلب تصحيح أو تحديث بياناتك.</li>
              <li>طلب حذف بياناتك (وفقاً للالتزامات القانونية).</li>
              <li>الاعتراض على معالجة بياناتك لأغراض معيّنة.</li>
            </ul>
          </Section>

          <Section title="تعديلات على السياسة">
            نحتفظ بحق تعديل هذه السياسة في أي وقت، وسيتم نشر النسخة المحدّثة على هذه الصفحة مع تاريخ التحديث.
          </Section>

          <Section title="التواصل معنا">
            لأي استفسار يخصّ سياسة الخصوصية، يمكنك التواصل عبر:
            <ul>
              <li>البريد الإلكتروني: <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></li>
              <li>الجوال: <span className="num" dir="ltr">{CONTACT.phone}</span></li>
            </ul>
          </Section>
        </article>
      </main>

      <Footer />
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-7 last:mb-0">
    <h2 className="mb-3 font-display text-xl font-bold text-foreground sm:text-2xl">{title}</h2>
    <div className="space-y-2 leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline [&_li]:my-1 [&_strong]:text-foreground [&_ul]:mr-6 [&_ul]:list-disc">
      {children}
    </div>
  </section>
);

export default Privacy;
