import { Link } from "react-router-dom";
import { ArrowRight, FileText } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { COMPANY, PROJECT, CONTACT } from "@/lib/config";

/**
 * صفحة الشروط والأحكام
 * Terms & Conditions page
 */
const Terms = () => {
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
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-extrabold sm:text-4xl">الشروط والأحكام</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              آخر تحديث: {new Date().toLocaleDateString("ar-SA-u-nu-latn", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>

        <article className="prose prose-slate mt-8 max-w-none rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          <Section title="مقدمة">
            مرحباً بك في موقع <strong>{COMPANY.name}</strong> الخاص بمشروع{" "}
            <strong>{PROJECT.nameAr}</strong>. باستخدامك هذا الموقع، فإنك توافق على الالتزام بهذه
            الشروط والأحكام. يُرجى قراءتها بعناية قبل المتابعة.
          </Section>

          <Section title="طبيعة الخدمة">
            يوفّر هذا الموقع منصّة إلكترونية لاستعراض الوحدات المتاحة في المشروع وتقديم طلبات الحجز المبدئي.
            تقديم الطلب لا يعني تأكيد الحجز، إذ يخضع للمراجعة والتأكيد من إدارة المشروع.
          </Section>

          <Section title="أهلية الاستخدام">
            <ul>
              <li>يجب أن يكون عمر المستخدم 18 عاماً فأكثر، أو أن يحوز الأهلية القانونية لإبرام العقود.</li>
              <li>يجب تقديم بيانات صحيحة ودقيقة عند إرسال طلب الحجز.</li>
              <li>تتحمّل وحدك مسؤولية أي معلومات غير صحيحة تُقدّمها.</li>
            </ul>
          </Section>

          <Section title="عملية الحجز">
            <ul>
              <li>اختيار المبنى ثم الوحدة المتاحة المناسبة لنشاطك.</li>
              <li>تعبئة بياناتك الشخصية وبيانات النشاط التجاري.</li>
              <li>إرسال الطلب عبر واتساب لإدارة المشروع للمراجعة.</li>
              <li>سيتم التواصل معك خلال أيام العمل لاستكمال الإجراءات.</li>
              <li>يتمّ تأكيد الحجز فقط بعد توقيع العقد ودفع المستحقات حسب الاتفاق.</li>
            </ul>
          </Section>

          <Section title="الأسعار والمدفوعات">
            <ul>
              <li>الأسعار المعروضة سنوية وقابلة للتفاوض حسب طبيعة العقد.</li>
              <li>تخضع الأسعار للتعديل دون إشعار مسبق قبل توقيع العقد.</li>
              <li>تفاصيل الدفع والشروط المالية تُحدَّد في عقد التأجير الرسمي.</li>
            </ul>
          </Section>

          <Section title="حقوق الملكية الفكرية">
            جميع المحتويات المعروضة على الموقع — من نصوص وصور وشعارات ومخططات — مملوكة لـ
            <strong> {COMPANY.name}</strong> أو الجهات المالكة للمشروع، ولا يجوز نسخها أو إعادة نشرها أو استخدامها
            تجارياً دون إذن خطّي مسبق.
          </Section>

          <Section title="استخدام الموقع">
            يلتزم المستخدم بعدم:
            <ul>
              <li>إساءة استخدام الموقع أو محاولة اختراقه أو تعطيله.</li>
              <li>إرسال طلبات وهمية أو معلومات مضلّلة.</li>
              <li>استخدام الموقع لأي غرض غير قانوني أو يتعارض مع الأنظمة المعمول بها.</li>
            </ul>
          </Section>

          <Section title="إخلاء المسؤولية">
            <ul>
              <li>المعلومات معروضة "كما هي" دون أي ضمانات صريحة أو ضمنية.</li>
              <li>قد تتغيّر حالة الوحدات (متاحة/مؤجّرة) في أي لحظة، وتُعتمد الحالة الفعلية وقت تأكيد الحجز.</li>
              <li>لا نتحمّل أي مسؤولية عن أضرار غير مباشرة قد تنجم عن استخدام الموقع.</li>
            </ul>
          </Section>

          <Section title="القانون المعمول به">
            تخضع هذه الشروط لأنظمة المملكة العربية السعودية، وتختصّ الجهات القضائية في مكة المكرمة بالنظر في أي
            نزاع قد ينشأ عن استخدام الموقع.
          </Section>

          <Section title="تعديل الشروط">
            نحتفظ بحقّ تعديل هذه الشروط في أي وقت، وتسري التعديلات فور نشرها على هذه الصفحة. استمرار استخدامك للموقع
            بعد التعديل يُعدّ موافقة على الشروط الجديدة.
          </Section>

          <Section title="التواصل">
            لأي استفسار يخصّ هذه الشروط، تواصل معنا عبر:
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

export default Terms;
