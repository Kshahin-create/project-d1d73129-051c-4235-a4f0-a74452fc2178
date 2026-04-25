import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Home, CheckCircle2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProgressSteps } from "@/components/ProgressSteps";
import { BuildingSelector } from "@/components/BuildingSelector";
import { UnitGrid } from "@/components/UnitGrid";
import { UnitDetailsCard } from "@/components/UnitDetailsCard";
import { CustomerForm, type CustomerFormData } from "@/components/CustomerForm";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { buildWhatsAppLinks, buildWhatsAppMessage } from "@/lib/whatsapp";
import { useBuildingsAndUnits } from "@/hooks/useBuildings";
import type { Unit, Building } from "@/data/types";

/**
 * صور مخططات المباني - أضف الصور إلى src/assets/plans/ بالاسم building-{n}.png
 * Building plan images: drop files into src/assets/plans/building-{n}.png
 * Using Vite's import.meta.glob to load them dynamically without breaking if missing.
 */
const planModules = import.meta.glob("@/assets/plans/building-*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

function getPlanImage(buildingNumber: number): string | undefined {
  const key = Object.keys(planModules).find((k) => k.endsWith(`building-${buildingNumber}.png`));
  return key ? planModules[key] : undefined;
}

const STEPS = ["المبنى", "الوحدة", "التفاصيل", "بياناتك", "الإرسال"];
const FORM_ID = "customer-booking-form";

const Booking = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activityFilter = searchParams.get("activity") as "service" | "parts" | null;
  const [step, setStep] = useState(1);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [customer, setCustomer] = useState<CustomerFormData | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const bookingContentRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useBuildingsAndUnits();
  const buildings = data?.buildings ?? [];
  const units = data?.units ?? [];

  const buildingUnits = useMemo(
    () => (selectedBuilding ? units.filter((u) => u.buildingNumber === selectedBuilding.number) : []),
    [selectedBuilding, units]
  );

  const whatsapp = useMemo(() => {
    if (!selectedUnit || !customer) return null;
    const data = {
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email || undefined,
      business: customer.business,
      notes: customer.notes || undefined,
    };
    return {
      ...buildWhatsAppLinks(selectedUnit, data),
      message: buildWhatsAppMessage(selectedUnit, data),
    };
  }, [selectedUnit, customer]);

  const handleBuildingSelect = (b: Building) => {
    setSelectedBuilding(b);
    setSelectedUnit(null);
    setStep(2);
  };

  const handleUnitSelect = (u: Unit) => {
    if (u.status === "rented") return;
    setSelectedUnit(u);
    setStep(3);
  };

  const handleFormSubmit = (data: CustomerFormData) => {
    setCustomer(data);
    setStep(5);
  };

  useEffect(() => {
    if (step !== 1) return;
    const timeout = window.setTimeout(() => {
      bookingContentRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    }, 80);
    return () => window.clearTimeout(timeout);
  }, [activityFilter, isLoading, step]);

  const goBack = () => {
    if (step === 1) {
      navigate("/");
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container-tight py-8 sm:py-10">
        {/* Breadcrumb + back */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={goBack}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowRight className="h-4 w-4" />
            {step === 1 ? "الرئيسية" : "السابق"}
          </button>
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
            <Home className="h-3.5 w-3.5" /> الرئيسية
          </Link>
        </div>

        {/* Progress */}
        <div className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
          <ProgressSteps current={step} steps={STEPS} />
        </div>

        {/* Step content */}
        <div ref={bookingContentRef} className="scroll-mt-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            {step === 1 && (
              <StepWrap title="اختر المبنى المناسب" desc="تصفح المباني المتاحة واختر المبنى الذي يناسب نشاطك.">
                <BuildingSelector
                  buildings={buildings}
                  units={units}
                  onSelect={handleBuildingSelect}
                  selected={selectedBuilding?.number}
                  activityFilter={activityFilter}
                />
              </StepWrap>
            )}

            {step === 2 && selectedBuilding && (
              <StepWrap
                title={`المبنى رقم ${selectedBuilding.number} — ${selectedBuilding.type}`}
                desc="راجع مخطط المبنى واختر الوحدة التي ترغب بحجزها. الوحدات المؤجرة مقفلة."
              >
                <UnitGrid
                  buildingNumber={selectedBuilding.number}
                  units={buildingUnits}
                  selectedUnit={selectedUnit?.unitNumber}
                  onSelect={handleUnitSelect}
                  planImage={getPlanImage(selectedBuilding.number)}
                />
              </StepWrap>
            )}

            {step === 3 && selectedUnit && (
              <StepWrap title="تفاصيل الوحدة" desc="راجع تفاصيل الوحدة قبل المتابعة.">
                <div className="mx-auto max-w-xl space-y-4">
                  <UnitDetailsCard unit={selectedUnit} />
                  <button
                    onClick={() => setStep(4)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3.5 font-display text-base font-bold text-primary-foreground shadow-card transition hover:shadow-elevated"
                  >
                    متابعة إلى بيانات العميل
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                </div>
              </StepWrap>
            )}

            {step === 4 && selectedUnit && (
              <StepWrap title="بياناتك" desc="أدخل بياناتك لإتمام طلب الحجز.">
                <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-5">
                  <div className="lg:col-span-3">
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
                      <CustomerForm formId={FORM_ID} onSubmit={handleFormSubmit} />
                      <button
                        type="submit"
                        form={FORM_ID}
                        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3.5 font-display font-bold text-primary-foreground shadow-card transition hover:shadow-elevated"
                      >
                        متابعة إلى الإرسال
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="lg:col-span-2">
                    <UnitDetailsCard unit={selectedUnit} />
                  </div>
                </div>
              </StepWrap>
            )}

            {step === 5 && selectedUnit && customer && (
              <StepWrap title="إرسال الطلب" desc="ستفتح محادثة واتساب جاهزة بكل تفاصيل طلبك.">
                <div className="mx-auto max-w-xl space-y-5">
                  {submitted ? (
                    <div className="rounded-2xl border border-success/30 bg-success/5 p-8 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success text-success-foreground">
                        <CheckCircle2 className="h-8 w-8" />
                      </div>
                      <h3 className="mt-4 font-display text-xl font-bold">تم فتح واتساب</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        إذا لم يُفتح تلقائياً، يمكنك الضغط على الزر مرة أخرى.
                      </p>
                      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                        <Link
                          to="/"
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium transition hover:border-primary/40"
                        >
                          العودة للرئيسية
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      <UnitDetailsCard unit={selectedUnit} />
                      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                        <h4 className="mb-3 font-display font-bold">ملخص بياناتك</h4>
                        <dl className="space-y-1.5 text-sm">
                          <SummaryRow label="الاسم" value={customer.fullName} />
                          <SummaryRow label="الجوال" value={customer.phone} ltr />
                          {customer.email && <SummaryRow label="البريد" value={customer.email} ltr />}
                          <SummaryRow label="النشاط" value={customer.business} />
                          {customer.notes && <SummaryRow label="ملاحظات" value={customer.notes} />}
                        </dl>
                      </div>
                      <WhatsAppButton
                        href={whatsapp?.appUrl ?? "#"}
                        webHref={whatsapp?.webUrl}
                        message={whatsapp?.message}
                        onClick={() => setTimeout(() => setSubmitted(true), 600)}
                      />
                      <p className="text-center text-xs text-muted-foreground">
                        سيتم نسخ الرسالة تلقائياً وفتح واتساب. إذا لم يكن التطبيق مثبّتاً، استخدم رابط واتساب ويب البديل.
                      </p>
                    </>
                  )}
                </div>
              </StepWrap>
            )}
          </motion.div>
        </AnimatePresence>
        </div>
      </main>

      <Footer />
    </div>
  );
};

const StepWrap = ({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) => (
  <div>
    <div className="mb-6 text-center sm:text-right">
      <h2 className="font-display text-2xl font-extrabold sm:text-3xl">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
    </div>
    {children}
  </div>
);

const SummaryRow = ({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className={`font-medium ${ltr ? "num" : ""}`} dir={ltr ? "ltr" : undefined}>
      {value}
    </dd>
  </div>
);

export default Booking;
