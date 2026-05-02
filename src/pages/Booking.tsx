import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Home, CheckCircle2, X as XIcon, LogIn, UserCircle2 } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Unit, Building } from "@/data/types";

const planModules = import.meta.glob("@/assets/plans/building-*.{svg,png,jpg,jpeg}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

function getPlanImage(buildingNumber: number): string | undefined {
  // Prefer SVG > PNG > JPG for sharper rendering
  const exts = ["svg", "png", "jpg", "jpeg"];
  for (const ext of exts) {
    const key = Object.keys(planModules).find((k) => k.endsWith(`building-${buildingNumber}.${ext}`));
    if (key) return planModules[key];
  }
  return undefined;
}

const STEPS = ["المبنى", "الوحدات", "التفاصيل", "بياناتك", "الإرسال"];
const FORM_ID = "customer-booking-form";

const Booking = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activityFilter = searchParams.get("activity") as "service" | "parts" | null;
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [creatingBooking, setCreatingBooking] = useState(false);

  // إجبار تسجيل الدخول قبل الحجز
  useEffect(() => {
    if (!authLoading && !user) {
      toast.info("سجّل دخولك أو أنشئ حساب لإتمام الحجز");
      navigate("/auth?redirect=/booking" + (activityFilter ? `?activity=${activityFilter}` : ""));
    }
  }, [user, authLoading, navigate, activityFilter]);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedUnits, setSelectedUnits] = useState<Unit[]>([]);
  const [customer, setCustomer] = useState<CustomerFormData | null>(null);
  const [savedProfile, setSavedProfile] = useState<Partial<CustomerFormData> | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const bookingContentRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useBuildingsAndUnits();
  const buildings = data?.buildings ?? [];
  const units = data?.units ?? [];

  // Fetch saved customer profile when user logs in
  useEffect(() => {
    if (!user) {
      setSavedProfile(null);
      return;
    }
    supabase
      .from("customer_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSavedProfile({
            fullName: data.full_name ?? "",
            phone: data.phone ?? "",
            email: data.email ?? user.email ?? "",
            business: data.business_name ?? "",
            notes: data.notes ?? "",
          });
        } else {
          setSavedProfile({ email: user.email ?? "" });
        }
      });
  }, [user]);

  const buildingUnits = useMemo(
    () => (selectedBuilding ? units.filter((u) => u.buildingNumber === selectedBuilding.number) : []),
    [selectedBuilding, units]
  );

  const selectedUnitNumbers = useMemo(() => selectedUnits.map((u) => u.unitNumber), [selectedUnits]);

  const totals = useMemo(() => {
    const area = selectedUnits.reduce((s, u) => s + u.area, 0);
    const price = selectedUnits.reduce((s, u) => s + u.price, 0);
    return { area, price, count: selectedUnits.length };
  }, [selectedUnits]);

  const whatsapp = useMemo(() => {
    if (selectedUnits.length === 0 || !customer) return null;
    const data = {
      fullName: customer.fullName,
      phone: customer.phone,
      email: customer.email || undefined,
      business: customer.business,
      notes: customer.notes || undefined,
    };
    return {
      ...buildWhatsAppLinks(selectedUnits, data),
      message: buildWhatsAppMessage(selectedUnits, data),
    };
  }, [selectedUnits, customer]);

  const handleBuildingSelect = (b: Building) => {
    setSelectedBuilding(b);
    setSelectedUnits([]);
    setStep(2);
  };

  const handleUnitToggle = (u: Unit) => {
    if (u.status === "rented" || u.status === "reserved") return;
    setSelectedUnits((prev) => {
      const exists = prev.some((p) => p.unitNumber === u.unitNumber && p.buildingNumber === u.buildingNumber);
      if (exists) {
        return prev.filter((p) => !(p.unitNumber === u.unitNumber && p.buildingNumber === u.buildingNumber));
      }
      return [...prev, u];
    });
  };

  const removeSelected = (u: Unit) => {
    setSelectedUnits((prev) =>
      prev.filter((p) => !(p.unitNumber === u.unitNumber && p.buildingNumber === u.buildingNumber))
    );
  };

  const handleFormSubmit = (data: CustomerFormData) => {
    setCustomer(data);
    // حفظ بيانات البروفايل (fire-and-forget)
    if (user) {
      supabase
        .from("customer_profiles")
        .upsert(
          {
            user_id: user.id,
            full_name: data.fullName,
            phone: data.phone,
            email: data.email || user.email,
            business_name: data.business,
            notes: data.notes || null,
          },
          { onConflict: "user_id" }
        )
        .then(({ error }) => {
          if (error) console.error("profile save error:", error);
        });
    }
    setStep(5);
  };

  // إنشاء الحجز في قاعدة البيانات (تغيير حالة الوحدات إلى محجوزة)
  const createBookingInDb = async (): Promise<string | null> => {
    if (!user || !customer || selectedUnits.length === 0) return null;
    if (bookingId) return bookingId; // موجود بالفعل
    setCreatingBooking(true);
    const { data: newId, error } = await supabase.rpc("create_booking", {
      _customer_full_name: customer.fullName,
      _customer_phone: customer.phone,
      _customer_email: customer.email || user.email || null,
      _business_name: customer.business || null,
      _notes: customer.notes || null,
      _unit_ids: selectedUnits.map((u) => u.id).filter(Boolean) as string[],
    });
    setCreatingBooking(false);
    if (error || !newId) {
      toast.error(error?.message || "تعذّر إنشاء الحجز");
      return null;
    }
    setBookingId(newId as string);
    toast.success("تم تسجيل حجزك ✅ — أكمل لإرسال البيانات على واتساب");
    return newId as string;
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

        <div className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
          <ProgressSteps current={step} steps={STEPS} />
        </div>

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
                desc="يمكنك اختيار وحدة واحدة أو أكثر. اضغط على الوحدة لإضافتها/إزالتها، ثم اضغط متابعة."
              >
                <UnitGrid
                  buildingNumber={selectedBuilding.number}
                  units={buildingUnits}
                  selectedUnits={selectedUnitNumbers}
                  onSelect={handleUnitToggle}
                  planImage={getPlanImage(selectedBuilding.number)}
                />

                {/* Sticky selection bar */}
                <div className="sticky bottom-3 z-30 mt-6">
                  <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-elevated backdrop-blur-md">
                    {selectedUnits.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground">
                        لم تختر أي وحدة بعد — اضغط على الوحدات في المخطط أو القائمة.
                      </p>
                    ) : (
                      <>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-bold">
                            الوحدات المختارة:{" "}
                            <span className="num text-primary">{totals.count}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            إجمالي المساحة:{" "}
                            <span className="num font-bold text-foreground">{totals.area}</span> م² —
                            الإيجار السنوي:{" "}
                            <span className="num font-bold text-accent">
                              {totals.price.toLocaleString("en-US")}
                            </span>{" "}
                            ريال
                          </div>
                        </div>
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {selectedUnits.map((u) => (
                            <span
                              key={`${u.buildingNumber}-${u.unitNumber}`}
                              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary"
                            >
                              <span className="num">#{u.unitNumber}</span>
                              <button
                                type="button"
                                onClick={() => removeSelected(u)}
                                className="rounded-full p-0.5 transition hover:bg-primary/20"
                                aria-label={`إزالة الوحدة ${u.unitNumber}`}
                              >
                                <XIcon className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="mb-2 text-[11px] text-muted-foreground text-center">
                          الإيجار السنوي المُعلّن غير شامل ضريبة القيمة المضافة ١٥٪؜
                        </div>
                      </>
                    )}
                    <button
                      onClick={() => setStep(3)}
                      disabled={selectedUnits.length === 0}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3 font-display text-base font-bold text-primary-foreground shadow-card transition hover:shadow-elevated disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      متابعة ({selectedUnits.length})
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </StepWrap>
            )}

            {step === 3 && selectedUnits.length > 0 && (
              <StepWrap title="تفاصيل الوحدات" desc="راجع تفاصيل الوحدات قبل المتابعة.">
                <div className="mx-auto max-w-3xl space-y-4">
                  <SelectionTotals totals={totals} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {selectedUnits.map((u) => (
                      <UnitDetailsCard key={`${u.buildingNumber}-${u.unitNumber}`} unit={u} />
                    ))}
                  </div>
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

            {step === 4 && selectedUnits.length > 0 && (
              <StepWrap title="بياناتك" desc="أدخل بياناتك لإتمام طلب الحجز.">
                <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-5">
                  <div className="lg:col-span-3 space-y-4">
                    {!user ? (
                      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
                        <div className="flex items-start gap-3">
                          <LogIn className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                          <div className="flex-1">
                            <p className="font-bold text-foreground">سجّل حسابك واحفظ بياناتك</p>
                            <p className="mt-1 text-muted-foreground">
                              لو عملت حساب، بياناتك هتتحفظ وتتعبّى تلقائياً في أي حجز جاي.
                            </p>
                            <Link
                              to="/auth"
                              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                            >
                              تسجيل / إنشاء حساب
                              <ArrowLeft className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-success/30 bg-success/5 p-3 text-sm">
                        <div className="flex items-center gap-2">
                          <UserCircle2 className="h-5 w-5 text-success" />
                          <span className="text-muted-foreground">
                            مسجّل دخول كـ <span className="font-bold text-foreground">{user.email}</span> — بياناتك هتتحفظ تلقائياً.
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
                      <CustomerForm
                        formId={FORM_ID}
                        onSubmit={handleFormSubmit}
                        defaultValues={savedProfile ?? undefined}
                      />
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
                  <div className="lg:col-span-2 space-y-3">
                    <SelectionTotals totals={totals} />
                    {selectedUnits.map((u) => (
                      <UnitDetailsCard key={`${u.buildingNumber}-${u.unitNumber}`} unit={u} />
                    ))}
                  </div>
                </div>
              </StepWrap>
            )}

            {step === 5 && selectedUnits.length > 0 && customer && (
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
                      <SelectionTotals totals={totals} />
                      <div className="space-y-3">
                        {selectedUnits.map((u) => (
                          <UnitDetailsCard key={`${u.buildingNumber}-${u.unitNumber}`} unit={u} />
                        ))}
                      </div>
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
                        onClick={() => {
                          // إرسال بيانات الحجز إلى n8n (fire-and-forget)
                          if (customer && selectedUnits.length > 0) {
                            supabase.functions
                              .invoke("booking-webhook", {
                                body: {
                                  customer: {
                                    fullName: customer.fullName,
                                    phone: customer.phone,
                                    email: customer.email || undefined,
                                    business: customer.business,
                                    notes: customer.notes || undefined,
                                  },
                                  units: selectedUnits.map((u) => ({
                                    buildingNumber: u.buildingNumber,
                                    buildingType: u.buildingType,
                                    unitNumber: u.unitNumber,
                                    unitType: u.unitType,
                                    area: u.area,
                                    activity: u.activity,
                                    price: u.price,
                                  })),
                                  message: whatsapp?.message,
                                },
                              })
                              .then(({ error }) => {
                                if (error) console.error("n8n webhook error:", error);
                              });
                          }
                          setTimeout(() => setSubmitted(true), 600);
                        }}
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

const SelectionTotals = ({ totals }: { totals: { count: number; area: number; price: number } }) => (
  <div className="rounded-2xl border border-accent/30 bg-accent-soft/30 p-4 shadow-card">
    <div className="grid grid-cols-3 gap-3 text-center">
      <div>
        <div className="text-[11px] text-muted-foreground">عدد الوحدات</div>
        <div className="num mt-1 font-display text-xl font-extrabold text-primary">{totals.count}</div>
      </div>
      <div>
        <div className="text-[11px] text-muted-foreground">إجمالي المساحة</div>
        <div className="num mt-1 font-display text-xl font-extrabold">
          {totals.area} <span className="text-xs font-medium text-muted-foreground">م²</span>
        </div>
      </div>
      <div>
        <div className="text-[11px] text-muted-foreground">الإيجار السنوي</div>
        <div className="num mt-1 font-display text-xl font-extrabold text-accent">
          {totals.price.toLocaleString("en-US")}
        </div>
      </div>
    </div>
    <p className="mt-2 text-center text-[11px] text-muted-foreground">
      الإيجار السنوي المُعلّن غير شامل ضريبة القيمة المضافة ١٥٪؜
    </p>
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
