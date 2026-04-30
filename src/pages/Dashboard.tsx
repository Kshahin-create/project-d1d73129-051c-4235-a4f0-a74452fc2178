import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useBuildingsAndUnits } from "@/hooks/useBuildings";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Package, FileText, CheckCircle2, Circle, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(Math.round(n));

type FilterKey =
  | "all"
  | "rented"
  | "available"
  | "ركنية"
  | "داخلية"
  | "صيانة"
  | "بنشر"
  | "قطع غيار";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "rented", label: "مؤجر" },
  { key: "available", label: "شاغر" },
  { key: "ركنية", label: "ركنية" },
  { key: "داخلية", label: "داخلية" },
  { key: "صيانة", label: "صيانة سيارات" },
  { key: "بنشر", label: "بنشر" },
  { key: "قطع غيار", label: "قطع غيار" },
];

const Dashboard = () => {
  const { data, isLoading } = useBuildingsAndUnits();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [pulse, setPulse] = useState(false);

  // Realtime subscription on units (public table)
  useEffect(() => {
    const channel = supabase
      .channel("public:units:dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "units" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["buildings-units"] });
          setLastUpdate(new Date());
          setPulse(true);
          setTimeout(() => setPulse(false), 1200);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    if (data) setLastUpdate(new Date());
  }, [data]);

  const buildings = data?.buildings ?? [];
  const units = data?.units ?? [];

  const stats = useMemo(() => {
    const total = units.length;
    const rented = units.filter((u) => u.status === "rented").length;
    const available = total - rented;
    const totalArea = units.reduce((s, u) => s + (Number(u.area) || 0), 0);
    const rentedRevenue = units
      .filter((u) => u.status === "rented")
      .reduce((s, u) => s + (Number(u.price) || 0), 0);
    const totalPotentialRevenue = units.reduce(
      (s, u) => s + (Number(u.price) || 0),
      0,
    );
    const occupancy = total ? (rented / total) * 100 : 0;
    return {
      total,
      rented,
      available,
      totalArea,
      rentedRevenue,
      totalPotentialRevenue,
      gap: totalPotentialRevenue - rentedRevenue,
      occupancy,
    };
  }, [units]);

  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      switch (filter) {
        case "all":
          return true;
        case "rented":
          return u.status === "rented";
        case "available":
          return u.status === "available";
        case "ركنية":
          return u.unitType === "ركنية";
        case "داخلية":
          return u.unitType === "داخلية";
        case "صيانة":
          return (u.activity ?? "").includes("صيانة");
        case "بنشر":
          return (u.activity ?? "").includes("بنشر");
        case "قطع غيار":
          return (u.activity ?? "").includes("قطع");
      }
    });
  }, [units, filter]);

  const targetPct = 40;
  const progressStatus =
    stats.occupancy >= targetPct
      ? { label: "تم تحقيق المستهدف ✓", cls: "bg-green-100 text-green-800" }
      : stats.occupancy >= targetPct * 0.6
        ? { label: "في الطريق نحو المستهدف", cls: "bg-amber-100 text-amber-800" }
        : { label: "أقل من المستهدف", cls: "bg-red-100 text-red-800" };

  const kpis = [
    {
      label: "إجمالي المباني",
      value: buildings.length || 10,
      sub: "صيانة سيارات · بنشر · قطع غيار",
      Icon: Building2,
      tone: "navy" as const,
    },
    {
      label: "إجمالي الوحدات",
      value: stats.total,
      sub: `${fmt(stats.totalArea)} م² إجمالي المساحات`,
      Icon: Package,
      tone: "gold" as const,
    },
    {
      label: "وحدات مؤجرة",
      value: stats.rented,
      sub: stats.total
        ? `${((stats.rented / stats.total) * 100).toFixed(1)}% من الإجمالي`
        : "—",
      Icon: FileText,
      tone: "blue" as const,
    },
    {
      label: "وحدات شاغرة",
      value: stats.available,
      sub: stats.total
        ? `${((stats.available / stats.total) * 100).toFixed(1)}% متاح للحجز`
        : "—",
      Icon: Circle,
      tone: "red" as const,
    },
    {
      label: "إيراد سنوي محقق",
      value: fmt(stats.rentedRevenue),
      sub: "ريال سعودي / سنة",
      Icon: Wallet,
      tone: "amber" as const,
      isCurrency: true,
    },
    {
      label: "نسبة الإشغال",
      value: `${stats.occupancy.toFixed(1)}%`,
      sub: `المستهدف ${targetPct}%`,
      Icon: CheckCircle2,
      tone: "green" as const,
      isCurrency: true,
    },
  ];

  const toneClasses: Record<string, string> = {
    navy: "border-t-primary [&_.icon]:bg-primary/10 [&_.icon]:text-primary",
    gold: "border-t-accent [&_.icon]:bg-accent/10 [&_.icon]:text-accent-foreground",
    green: "border-t-green-600 [&_.icon]:bg-green-100 [&_.icon]:text-green-700",
    amber: "border-t-amber-600 [&_.icon]:bg-amber-100 [&_.icon]:text-amber-700",
    red: "border-t-red-600 [&_.icon]:bg-red-100 [&_.icon]:text-red-700",
    blue: "border-t-blue-700 [&_.icon]:bg-blue-100 [&_.icon]:text-blue-700",
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>داشبورد المدينة الصناعية بشمال مكة | نخبة تسكين</title>
        <meta
          name="description"
          content="داشبورد لحظي لأداء المدينة الصناعية بشمال مكة المكرمة: إشغال، إيرادات، وتفاصيل الوحدات."
        />
        <link rel="canonical" href="/dashboard" />
      </Helmet>

      <Header />

      {/* Hero strip */}
      <section className="border-b bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="container-tight flex flex-wrap items-center justify-between gap-4 py-6">
          <div>
            <h1 className="font-display text-xl font-bold sm:text-2xl">
              داشبورد المدينة الصناعية بشمال مكة المكرمة
            </h1>
            <p className="mt-1 text-xs opacity-80 sm:text-sm">
              المستثمر: القمة الهادفة الحديثة · مدير التشغيل: نخبة تسكين العقارية
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs sm:text-sm">
            <div className="flex flex-col">
              <span className="opacity-70">المستهدف</span>
              <span className="font-semibold">إشغال {targetPct}% خلال 6 أشهر</span>
            </div>
            <div className="flex flex-col">
              <span className="opacity-70">آخر تحديث</span>
              <span className="num font-semibold flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block h-2 w-2 rounded-full bg-green-400",
                    pulse && "animate-ping",
                  )}
                  aria-hidden
                />
                {lastUpdate.toLocaleTimeString("ar-SA")}
              </span>
            </div>
          </div>
        </div>
      </section>

      <main className="container-tight space-y-8 py-8">
        {/* KPI grid */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {kpis.map(({ label, value, sub, Icon, tone, isCurrency }) => (
            <div
              key={label}
              className={cn(
                "relative overflow-hidden rounded-xl border-t-4 border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                toneClasses[tone],
              )}
            >
              <div className="icon absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg">
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-xs font-medium text-muted-foreground">{label}</div>
              <div
                className={cn(
                  "mt-2 font-display font-extrabold leading-none text-foreground",
                  isCurrency ? "text-2xl" : "text-3xl",
                )}
              >
                {isLoading ? "…" : typeof value === "number" ? fmt(value) : value}
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>
            </div>
          ))}
        </section>

        {/* Progress */}
        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-bold">
              التقدم نحو مستهدف الإشغال ({targetPct}%)
            </h2>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                progressStatus.cls,
              )}
            >
              {progressStatus.label}
            </span>
          </div>
          <div className="relative mb-3 h-9 overflow-hidden rounded-full bg-muted">
            <div
              className="flex h-full items-center justify-end rounded-full bg-gradient-to-l from-accent to-primary px-3 text-xs font-bold text-primary-foreground transition-all duration-700"
              style={{ width: `${Math.min(stats.occupancy, 100)}%` }}
            >
              {stats.occupancy.toFixed(1)}%
            </div>
            <div
              className="absolute -top-1 bottom-[-4px] w-0.5 bg-red-600"
              style={{ right: `${targetPct}%` }}
              aria-label={`خط المستهدف ${targetPct}%`}
            />
          </div>
          <div className="flex flex-wrap gap-5 text-xs text-muted-foreground">
            <span>🟦 الإشغال الحالي</span>
            <span>🔴 خط المستهدف {targetPct}%</span>
            <span>
              {fmt(stats.rented)} وحدة مؤجرة من {fmt(stats.total)}
            </span>
          </div>
        </section>

        {/* Revenue */}
        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="mb-5 flex items-center gap-2 border-b pb-3 font-display text-lg font-bold">
            <span className="h-5 w-1 rounded-sm bg-accent" /> الملخص المالي السنوي
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-gradient-to-br from-green-600 to-green-500 p-5 text-white">
              <div className="text-xs opacity-90">الإيراد المحقق (مؤجر)</div>
              <div className="num mt-1 text-2xl font-extrabold">
                {fmt(stats.rentedRevenue)}
              </div>
              <div className="text-xs opacity-80">ريال / سنة</div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground">
              <div className="text-xs opacity-90">الإيراد عند 100% إشغال</div>
              <div className="num mt-1 text-2xl font-extrabold">
                {fmt(stats.totalPotentialRevenue)}
              </div>
              <div className="text-xs opacity-80">ريال / سنة</div>
            </div>
            <div className="rounded-xl bg-gradient-to-br from-accent to-accent/70 p-5 text-foreground">
              <div className="text-xs opacity-80">الفجوة (إيراد محتمل)</div>
              <div className="num mt-1 text-2xl font-extrabold">
                {fmt(stats.gap)}
              </div>
              <div className="text-xs opacity-70">ريال / سنة</div>
            </div>
          </div>
        </section>

        {/* Buildings */}
        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="mb-5 flex items-center gap-2 border-b pb-3 font-display text-lg font-bold">
            <span className="h-5 w-1 rounded-sm bg-accent" /> أداء المباني
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {buildings.map((b) => {
              const bUnits = units.filter((u) => u.buildingNumber === b.number);
              const rented = bUnits.filter((u) => u.status === "rented").length;
              const total = bUnits.length;
              const free = total - rented;
              const pct = total ? (rented / total) * 100 : 0;
              const tone =
                pct >= 60
                  ? "from-green-500 to-emerald-500"
                  : pct >= 30
                    ? "from-amber-500 to-yellow-500"
                    : "from-red-500 to-red-400";
              const revenue = bUnits
                .filter((u) => u.status === "rented")
                .reduce((s, u) => s + Number(u.price), 0);
              return (
                <div
                  key={b.number}
                  className="rounded-xl border bg-gradient-to-b from-muted/30 to-card p-4 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="font-display text-sm font-bold">
                      مبنى رقم <span className="num">{b.number}</span>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {b.type}
                    </span>
                  </div>
                  <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/40 p-2">
                      <div className="num text-lg font-extrabold">{total}</div>
                      <div className="text-[10px] text-muted-foreground">إجمالي</div>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-2">
                      <div className="num text-lg font-extrabold text-blue-700">
                        {rented}
                      </div>
                      <div className="text-[10px] text-muted-foreground">مؤجر</div>
                    </div>
                    <div className="rounded-lg bg-red-50 p-2">
                      <div className="num text-lg font-extrabold text-red-700">
                        {free}
                      </div>
                      <div className="text-[10px] text-muted-foreground">شاغر</div>
                    </div>
                  </div>
                  <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full bg-gradient-to-l transition-all duration-700",
                        tone,
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold">إشغال {pct.toFixed(0)}%</span>
                    <span className="num font-semibold text-amber-700">
                      {fmt(revenue)} ر.س
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Units table */}
        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <span className="h-5 w-1 rounded-sm bg-accent" /> تفاصيل الوحدات
            </h2>
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {filteredUnits.length} وحدة
            </span>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-md border px-4 py-1.5 text-xs font-medium transition",
                  filter === f.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-accent",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-right text-sm">
              <thead className="bg-primary text-primary-foreground">
                <tr>
                  <th className="p-3 text-xs font-semibold">المبنى</th>
                  <th className="p-3 text-xs font-semibold">رقم الوحدة</th>
                  <th className="p-3 text-xs font-semibold">النوع</th>
                  <th className="p-3 text-xs font-semibold">المساحة</th>
                  <th className="p-3 text-xs font-semibold">النشاط</th>
                  <th className="p-3 text-xs font-semibold">الإيجار السنوي</th>
                  <th className="p-3 text-xs font-semibold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filteredUnits.slice(0, 500).map((u) => (
                  <tr
                    key={`${u.buildingNumber}-${u.unitNumber}`}
                    className="border-b last:border-0 hover:bg-muted/40"
                  >
                    <td className="num p-2.5 text-xs">{u.buildingNumber}</td>
                    <td className="num p-2.5 text-xs font-bold">{u.unitNumber}</td>
                    <td className="p-2.5 text-xs">{u.unitType ?? "—"}</td>
                    <td className="num p-2.5 text-xs">{u.area} م²</td>
                    <td className="p-2.5 text-xs">{u.activity ?? "—"}</td>
                    <td className="num p-2.5 text-xs font-semibold">
                      {fmt(u.price)}
                    </td>
                    <td className="p-2.5 text-xs">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          u.status === "rented"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-red-100 text-red-800",
                        )}
                      >
                        {u.status === "rented" ? "مؤجر" : "شاغر"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUnits.length > 500 && (
              <div className="border-t p-3 text-center text-xs text-muted-foreground">
                عرض أول 500 وحدة من {fmt(filteredUnits.length)}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
