import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useBuildingsAndUnits } from "@/hooks/useBuildings";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, Package, FileText, CheckCircle2, Circle, Wallet, Users,
  TrendingUp, BarChart3, PieChart as PieIcon, Activity, Layers, Target,
  Ruler, Coins, Percent, Search, ArrowUpRight, ArrowDownRight, MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UnitsMap } from "@/components/dashboard/UnitsMap";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, RadialBarChart, RadialBar,
  AreaChart, Area, ComposedChart, Line, LabelList,
} from "recharts";

type TenantRow = {
  id: string;
  tenant_name: string;
  business_name: string | null;
  activity_type: string | null;
  phone: string | null;
  units: { building_number: number; unit_number: number; activity: string | null; price?: number }[];
};

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));
const fmtSar = (n: number) => `${fmt(n)} ر.س`;

// Brand-aligned palette (HSL)
const C = {
  primary: "hsl(195 70% 25%)",
  primaryLight: "hsl(188 65% 42%)",
  gold: "hsl(38 78% 52%)",
  goldDeep: "hsl(32 75% 45%)",
  green: "hsl(152 60% 40%)",
  greenLight: "hsl(152 55% 55%)",
  amber: "hsl(38 92% 50%)",
  red: "hsl(0 72% 55%)",
  blue: "hsl(217 80% 50%)",
  slate: "hsl(195 15% 60%)",
  muted: "hsl(195 15% 88%)",
};

const STATUS_COLORS = {
  rented: C.primary,
  reserved: C.gold,
  available: C.green,
};

// Shared chart styling — visible ticks, RTL-friendly tooltip, subtle grid
const AXIS_TICK = { fontSize: 11, fill: "hsl(var(--foreground))", fontWeight: 500 } as const;
const AXIS_LINE = { stroke: "hsl(var(--border))" } as const;
const GRID_STROKE = "hsl(var(--border))";

const ChartTooltip = ({ active, payload, label, formatter, unit }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      dir="rtl"
      className="rounded-xl border border-border/70 bg-card/95 px-3 py-2 shadow-elevated backdrop-blur-md"
      style={{ minWidth: 140 }}
    >
      {label !== undefined && label !== "" && (
        <div className="mb-1.5 border-b border-border/60 pb-1 text-[11px] font-bold text-foreground">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((p: any, i: number) => {
          const raw = p.value;
          const val = formatter ? formatter(raw, p.name, p) : fmt(Number(raw));
          return (
            <div key={i} className="flex items-center justify-between gap-3 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: p.color || p.fill || p.payload?.color }}
                />
                <span className="text-muted-foreground">{p.name}</span>
              </div>
              <span className="num font-bold text-foreground">
                {val}
                {unit ? ` ${unit}` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const legendStyle = { fontSize: 12, color: "hsl(var(--foreground))", paddingTop: 8 } as const;

type FilterKey = "all" | "rented" | "reserved" | "available";

const Dashboard = () => {
  const { data, isLoading } = useBuildingsAndUnits();
  const queryClient = useQueryClient();
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [pulse, setPulse] = useState(false);
  const [unitFilter, setUnitFilter] = useState<FilterKey>("all");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [unitTypeFilter, setUnitTypeFilter] = useState<string>("all");
  const [unitSearch, setUnitSearch] = useState("");
  const [unitPage, setUnitPage] = useState(1);
  const PAGE_SIZE = 30;

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
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  useEffect(() => { if (data) setLastUpdate(new Date()); }, [data]);

  const buildings = data?.buildings ?? [];
  const units = data?.units ?? [];

  const { data: tenants = [] } = useQuery<TenantRow[]>({
    queryKey: ["dashboard-tenants"],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("tenants")
        .select("id, tenant_name, business_name, activity_type, phone, unit_id, units:unit_id (building_number, unit_number, activity, price)")
        .order("tenant_name", { ascending: true });
      if (error) throw error;
      const map = new Map<string, TenantRow>();
      for (const r of (rows ?? []) as any[]) {
        const key = `${(r.tenant_name || "").trim().toLowerCase()}__${(r.phone || "").trim()}`;
        const u = r.units;
        const existing = map.get(key);
        if (existing) {
          if (u) existing.units.push({ building_number: u.building_number, unit_number: u.unit_number, activity: u.activity, price: Number(u.price ?? 0) });
          if (!existing.business_name && r.business_name) existing.business_name = r.business_name;
          if (!existing.activity_type && r.activity_type) existing.activity_type = r.activity_type;
        } else {
          map.set(key, {
            id: r.id,
            tenant_name: r.tenant_name,
            business_name: r.business_name,
            activity_type: r.activity_type,
            phone: r.phone,
            units: u ? [{ building_number: u.building_number, unit_number: u.unit_number, activity: u.activity, price: Number(u.price ?? 0) }] : [],
          });
        }
      }
      return Array.from(map.values());
    },
  });

  // --- Aggregates ---
  const stats = useMemo(() => {
    const total = units.length;
    const rented = units.filter((u) => u.status === "rented").length;
    const reserved = units.filter((u) => u.status === "reserved").length;
    const available = units.filter((u) => u.status === "available").length;
    const totalArea = units.reduce((s, u) => s + (Number(u.area) || 0), 0);
    const rentedArea = units.filter((u) => u.status === "rented").reduce((s, u) => s + Number(u.area || 0), 0);
    const reservedArea = units.filter((u) => u.status === "reserved").reduce((s, u) => s + Number(u.area || 0), 0);
    const availableArea = units.filter((u) => u.status === "available").reduce((s, u) => s + Number(u.area || 0), 0);
    const rentedRevenue = units.filter((u) => u.status === "rented").reduce((s, u) => s + Number(u.price || 0), 0);
    const reservedRevenue = units.filter((u) => u.status === "reserved").reduce((s, u) => s + Number(u.price || 0), 0);
    const totalPotentialRevenue = units.reduce((s, u) => s + Number(u.price || 0), 0);
    const lostRevenue = units.filter((u) => u.status === "available").reduce((s, u) => s + Number(u.price || 0), 0);
    const occupancy = total ? (rented / total) * 100 : 0;
    const commitedOccupancy = total ? ((rented + reserved) / total) * 100 : 0;
    return {
      total, rented, reserved, available,
      totalArea, rentedArea, reservedArea, availableArea,
      rentedRevenue, reservedRevenue, totalPotentialRevenue,
      gap: totalPotentialRevenue - rentedRevenue,
      lostRevenue,
      occupancy, commitedOccupancy,
    };
  }, [units]);

  const targetPct = 40;
  const unitsToTarget = Math.max(0, Math.ceil((targetPct / 100) * stats.total - stats.rented));

  // --- Charts data ---
  const analytics = useMemo(() => {
    const statusData = [
      { name: "مؤجر", value: stats.rented, color: STATUS_COLORS.rented },
      { name: "محجوز", value: stats.reserved, color: STATUS_COLORS.reserved },
      { name: "متاح", value: stats.available, color: STATUS_COLORS.available },
    ].filter((d) => d.value > 0);

    // Activity buckets (3 + other)
    const activityBuckets: Record<string, { rented: number; reserved: number; available: number; total: number; revenue: number; potential: number; area: number }> = {
      "صيانة سيارات": { rented: 0, reserved: 0, available: 0, total: 0, revenue: 0, potential: 0, area: 0 },
      "بنشر": { rented: 0, reserved: 0, available: 0, total: 0, revenue: 0, potential: 0, area: 0 },
      "قطع غيار": { rented: 0, reserved: 0, available: 0, total: 0, revenue: 0, potential: 0, area: 0 },
      "أخرى": { rented: 0, reserved: 0, available: 0, total: 0, revenue: 0, potential: 0, area: 0 },
    };
    for (const u of units) {
      const a = u.activity ?? "";
      const key = a.includes("صيانة")
        ? "صيانة سيارات"
        : a.includes("بنشر")
          ? "بنشر"
          : a.includes("قطع")
            ? "قطع غيار"
            : "أخرى";
      activityBuckets[key].total += 1;
      activityBuckets[key].potential += Number(u.price) || 0;
      activityBuckets[key].area += Number(u.area) || 0;
      if (u.status === "rented") { activityBuckets[key].rented += 1; activityBuckets[key].revenue += Number(u.price) || 0; }
      else if (u.status === "reserved") activityBuckets[key].reserved += 1;
      else activityBuckets[key].available += 1;
    }
    const activityData = Object.entries(activityBuckets)
      .filter(([, v]) => v.total > 0)
      .map(([name, v]) => ({
        name,
        مؤجر: v.rented,
        محجوز: v.reserved,
        متاح: v.available,
        إيراد: Math.round(v.revenue),
        إمكانية: Math.round(v.potential),
        إشغال: v.total ? Math.round((v.rented / v.total) * 100) : 0,
      }));
    const activityPie = Object.entries(activityBuckets)
      .filter(([, v]) => v.total > 0)
      .map(([name, v], i) => ({
        name, value: v.total,
        color: [C.primary, C.gold, C.greenLight, C.slate][i % 4],
      }));

    const cornerCount = units.filter((u) => u.unitType === "ركنية").length;
    const innerCount = units.filter((u) => u.unitType === "داخلية").length;
    const unitTypeData = [
      { name: "ركنية", value: cornerCount, color: C.gold },
      { name: "داخلية", value: innerCount, color: C.primary },
    ].filter((d) => d.value > 0);

    // Building stack
    const buildingChart = buildings
      .map((b) => {
        const bu = units.filter((u) => u.buildingNumber === b.number);
        const rented = bu.filter((u) => u.status === "rented").length;
        const reserved = bu.filter((u) => u.status === "reserved").length;
        const available = bu.length - rented - reserved;
        const revenue = bu.filter((u) => u.status === "rented").reduce((s, u) => s + Number(u.price), 0);
        const potential = bu.reduce((s, u) => s + Number(u.price), 0);
        return {
          name: `م${b.number}`,
          number: b.number,
          مؤجر: rented, محجوز: reserved, متاح: available,
          إيراد: Math.round(revenue),
          فجوة: Math.round(potential - revenue),
          إجمالي: Math.round(potential),
          إشغال: bu.length ? Math.round((rented / bu.length) * 100) : 0,
        };
      })
      .sort((a, b) => a.number - b.number);

    // Price-band histogram of all units
    const bands = [
      { name: "<30k", min: 0, max: 30000 },
      { name: "30-50k", min: 30000, max: 50000 },
      { name: "50-70k", min: 50000, max: 70000 },
      { name: "70-100k", min: 70000, max: 100000 },
      { name: "100k+", min: 100000, max: Infinity },
    ];
    const priceBands = bands.map((b) => {
      const inBand = units.filter((u) => Number(u.price) >= b.min && Number(u.price) < b.max);
      return {
        name: b.name,
        وحدات: inBand.length,
        مؤجر: inBand.filter((u) => u.status === "rented").length,
      };
    });

    // Area histogram
    const areaBands = [
      { name: "<80", min: 0, max: 80 },
      { name: "80-120", min: 80, max: 120 },
      { name: "120-160", min: 120, max: 160 },
      { name: "160-200", min: 160, max: 200 },
      { name: "200+", min: 200, max: Infinity },
    ].map((b) => ({
      name: b.name,
      وحدات: units.filter((u) => Number(u.area) >= b.min && Number(u.area) < b.max).length,
    }));

    const rentedUnits = units.filter((u) => u.status === "rented");
    const avgPrice = rentedUnits.length ? rentedUnits.reduce((s, u) => s + Number(u.price), 0) / rentedUnits.length : 0;
    const avgArea = units.length ? units.reduce((s, u) => s + Number(u.area), 0) / units.length : 0;
    const totalRentedArea = rentedUnits.reduce((s, u) => s + Number(u.area), 0);
    const pricePerSqm = totalRentedArea ? rentedUnits.reduce((s, u) => s + Number(u.price), 0) / totalRentedArea : 0;
    const potentialPricePerSqm = stats.totalArea ? stats.totalPotentialRevenue / stats.totalArea : 0;

    const occupancyGauge = [
      { name: "إشغال", value: Number(stats.occupancy.toFixed(1)), fill: C.primary },
    ];

    const topTenants = [...tenants]
      .sort((a, b) => b.units.length - a.units.length)
      .slice(0, 10)
      .map((t) => ({
        name: t.tenant_name,
        وحدات: t.units.length,
        إيراد: Math.round(t.units.reduce((s, u) => s + Number(u.price || 0), 0)),
      }));

    // Building leaderboard
    const buildingLeaders = [...buildingChart]
      .sort((a, b) => b["إيراد"] - a["إيراد"])
      .slice(0, 8);

    return {
      statusData, activityData, activityPie, unitTypeData, buildingChart,
      priceBands, areaBands,
      avgPrice, avgArea, pricePerSqm, potentialPricePerSqm,
      occupancyGauge, topTenants, buildingLeaders,
      cornerCount, innerCount,
    };
  }, [units, buildings, tenants, stats]);

  // Filtered units
  const activityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const u of units) if (u.activity) set.add(u.activity);
    return Array.from(set);
  }, [units]);

  const filteredUnits = useMemo(() => {
    const s = unitSearch.trim().toLowerCase();
    return units.filter((u) => {
      if (unitFilter !== "all" && u.status !== unitFilter) return false;
      if (unitTypeFilter !== "all" && u.unitType !== unitTypeFilter) return false;
      if (activityFilter !== "all" && u.activity !== activityFilter) return false;
      if (s) {
        const hay = `${u.buildingNumber} ${u.unitNumber} ${u.activity ?? ""} ${u.unitType ?? ""} ${u.tenant ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [units, unitFilter, unitTypeFilter, activityFilter, unitSearch]);

  useEffect(() => { setUnitPage(1); }, [unitFilter, unitTypeFilter, activityFilter, unitSearch]);
  const pageCount = Math.max(1, Math.ceil(filteredUnits.length / PAGE_SIZE));
  const pagedUnits = filteredUnits.slice((unitPage - 1) * PAGE_SIZE, unitPage * PAGE_SIZE);

  // KPI cards (8)
  const kpis = [
    { label: "إجمالي المباني", value: buildings.length || 10, sub: "3 أنشطة تجارية", Icon: Building2, accent: "primary" as const, trend: null },
    { label: "إجمالي الوحدات", value: stats.total, sub: `${fmt(stats.totalArea)} م² إجمالي`, Icon: Package, accent: "gold" as const },
    { label: "وحدات مؤجرة", value: stats.rented, sub: `${stats.occupancy.toFixed(1)}% إشغال`, Icon: CheckCircle2, accent: "green" as const, isPositive: true },
    { label: "وحدات محجوزة", value: stats.reserved, sub: stats.total ? `${((stats.reserved / stats.total) * 100).toFixed(1)}% قيد الحجز` : "—", Icon: FileText, accent: "amber" as const },
    { label: "وحدات متاحة", value: stats.available, sub: `${fmt(stats.availableArea)} م² متاح`, Icon: Circle, accent: "blue" as const },
    { label: "الإيراد المحقق", value: fmtSar(stats.rentedRevenue), sub: "سنوياً (مؤجر فعلياً)", Icon: Wallet, accent: "green" as const, isCurrency: true, isPositive: true },
    { label: "الإيراد المحتمل", value: fmtSar(stats.totalPotentialRevenue), sub: "سنوياً عند 100% إشغال", Icon: TrendingUp, accent: "primary" as const, isCurrency: true },
    { label: "الفجوة (إيراد ضائع)", value: fmtSar(stats.lostRevenue), sub: `${unitsToTarget} وحدة للوصول للمستهدف`, Icon: ArrowDownRight, accent: "red" as const, isCurrency: true, isNegative: true },
  ];

  const accentMap: Record<string, { bg: string; text: string; border: string; ring: string }> = {
    primary: { bg: "bg-primary/10", text: "text-primary", border: "border-t-primary", ring: "ring-primary/20" },
    gold: { bg: "bg-accent/15", text: "text-accent-foreground", border: "border-t-accent", ring: "ring-accent/30" },
    green: { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-400", border: "border-t-emerald-500", ring: "ring-emerald-500/20" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-400", border: "border-t-amber-500", ring: "ring-amber-500/20" },
    blue: { bg: "bg-sky-500/10", text: "text-sky-700 dark:text-sky-400", border: "border-t-sky-500", ring: "ring-sky-500/20" },
    red: { bg: "bg-rose-500/10", text: "text-rose-700 dark:text-rose-400", border: "border-t-rose-500", ring: "ring-rose-500/20" },
  };

  const progressStatus =
    stats.occupancy >= targetPct
      ? { label: "تم تحقيق المستهدف ✓", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" }
      : stats.occupancy >= targetPct * 0.6
        ? { label: "في الطريق نحو المستهدف", cls: "bg-amber-100 text-amber-800 border-amber-300" }
        : { label: "أقل من المستهدف", cls: "bg-rose-100 text-rose-800 border-rose-300" };

  return (
    <div className="min-h-screen bg-background">
      {(() => { document.title = "داشبورد المدينة الصناعية بشمال مكة | نخبة تسكين"; return null; })()}

      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden border-b" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)",
          backgroundSize: "40px 40px, 60px 60px",
        }} />
        <div className="container-tight relative flex flex-col gap-4 py-6 text-primary-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:py-8">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-widest opacity-80 sm:text-xs">
              <span className="h-1 w-6 rounded-full bg-accent" />
              لوحة تحليلات الأداء
            </div>
            <h1 className="font-display text-xl font-bold leading-tight sm:text-3xl">
              داشبورد المدينة الصناعية بشمال مكة المكرمة
            </h1>
            <p className="mt-1.5 text-xs opacity-85 sm:text-sm">
              المستثمر: القمة الهادفة الحديثة · مدير التشغيل: نخبة تسكين العقارية
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs sm:text-sm">
            <div className="flex flex-col">
              <span className="opacity-70">المستهدف</span>
              <span className="font-semibold">إشغال {targetPct}% خلال 6 أشهر</span>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="flex flex-col">
              <span className="opacity-70">آخر تحديث</span>
              <span className="num flex items-center gap-2 font-semibold">
                <span className="relative flex h-2 w-2">
                  {pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                {lastUpdate.toLocaleTimeString("ar-SA-u-nu-latn")}
              </span>
            </div>
          </div>
        </div>
      </section>

      <main className="container-tight space-y-6 py-6 sm:py-8">
        {/* KPI grid */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(({ label, value, sub, Icon, accent, isCurrency, isPositive, isNegative }) => {
            const a = accentMap[accent];
            return (
              <Card key={label} className={cn(
                "relative overflow-hidden border-t-4 p-4 transition-all hover:-translate-y-0.5 hover:shadow-card",
                a.border,
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
                    <div className={cn(
                      "mt-1.5 font-display font-extrabold leading-tight text-foreground",
                      isCurrency ? "text-lg sm:text-xl" : "text-2xl sm:text-3xl",
                    )}>
                      {isLoading ? <span className="inline-block h-6 w-16 animate-pulse rounded bg-muted" /> :
                        (typeof value === "number" ? fmt(value) : value)}
                    </div>
                  </div>
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1", a.bg, a.text, a.ring)}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {isPositive && <ArrowUpRight className="h-3 w-3 text-emerald-600" />}
                  {isNegative && <ArrowDownRight className="h-3 w-3 text-rose-600" />}
                  <span className="truncate">{sub}</span>
                </div>
              </Card>
            );
          })}
        </section>

        {/* Progress to target */}
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold sm:text-lg">التقدم نحو مستهدف الإشغال</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">المستهدف الاستراتيجي: {targetPct}% خلال 6 أشهر</p>
            </div>
            <Badge className={cn("border", progressStatus.cls)}>{progressStatus.label}</Badge>
          </div>
          <div className="relative mb-3 h-10 overflow-hidden rounded-full bg-muted/60 ring-1 ring-border">
            {/* reserved overlay (lighter) */}
            <div
              className="absolute inset-y-0 right-0 bg-amber-300/40"
              style={{ width: `${Math.min(stats.commitedOccupancy, 100)}%` }}
            />
            {/* rented */}
            <div
              className="relative flex h-full items-center justify-end rounded-full bg-gradient-to-l from-accent via-primary to-primary/90 px-3 text-xs font-bold text-primary-foreground shadow-inner transition-all duration-700"
              style={{ width: `${Math.min(stats.occupancy, 100)}%` }}
            >
              <span className="num">{stats.occupancy.toFixed(1)}%</span>
            </div>
            {/* target line */}
            <div
              className="absolute -top-1 bottom-[-4px] w-0.5 bg-rose-600"
              style={{ right: `${targetPct}%` }}
              aria-label={`خط المستهدف ${targetPct}%`}
            >
              <span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white" style={{ right: 0 }}>
                {targetPct}%
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> الإشغال الحالي ({fmt(stats.rented)} وحدة)</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-300" /> محجوز ({fmt(stats.reserved)})</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-600" /> خط المستهدف</span>
            <span>للوصول للمستهدف: <span className="num font-bold text-foreground">{unitsToTarget}</span> وحدة إضافية</span>
          </div>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList dir="rtl" className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <PieIcon className="ml-1.5 h-3.5 w-3.5" /> نظرة عامة
            </TabsTrigger>
            <TabsTrigger value="financial" className="data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Coins className="ml-1.5 h-3.5 w-3.5" /> الأداء المالي
            </TabsTrigger>
            <TabsTrigger value="buildings" className="data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Building2 className="ml-1.5 h-3.5 w-3.5" /> المباني
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <BarChart3 className="ml-1.5 h-3.5 w-3.5" /> تحليلات تفصيلية
            </TabsTrigger>
            <TabsTrigger value="tenants" className="data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Users className="ml-1.5 h-3.5 w-3.5" /> المستأجرون
            </TabsTrigger>
            <TabsTrigger value="map" className="data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <MapPin className="ml-1.5 h-3.5 w-3.5" /> خريطة الوحدات
            </TabsTrigger>
            <TabsTrigger value="units" className="data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Package className="ml-1.5 h-3.5 w-3.5" /> الوحدات
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" dir="rtl" className="mt-5 space-y-5">
            {/* Mini KPIs */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" /> متوسط إيجار الوحدة المؤجرة
                </div>
                <div className="num mt-2 font-display text-2xl font-extrabold">{fmt(analytics.avgPrice)}</div>
                <div className="text-[11px] text-muted-foreground">ر.س / سنة</div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Ruler className="h-4 w-4 text-accent" /> متوسط المساحة
                </div>
                <div className="num mt-2 font-display text-2xl font-extrabold">{analytics.avgArea.toFixed(1)}</div>
                <div className="text-[11px] text-muted-foreground">م² / وحدة</div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Activity className="h-4 w-4 text-emerald-600" /> سعر المتر السنوي
                </div>
                <div className="num mt-2 font-display text-2xl font-extrabold">{fmt(analytics.pricePerSqm)}</div>
                <div className="text-[11px] text-muted-foreground">ر.س / م² (محقق)</div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-4 w-4 text-primary" /> عدد المستأجرين
                </div>
                <div className="num mt-2 font-display text-2xl font-extrabold">{tenants.length}</div>
                <div className="text-[11px] text-muted-foreground">{fmt(stats.rented)} وحدة مؤجرة</div>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* Status donut */}
              <Card className="p-5 lg:col-span-1">
                <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold">
                  <PieIcon className="h-4 w-4 text-accent" /> حالة الوحدات
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analytics.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={55} paddingAngle={2}>
                        {analytics.statusData.map((d, i) => <Cell key={i} fill={d.color} stroke="white" strokeWidth={2} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip formatter={(v: any) => fmt(Number(v))} />} cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }} />
                      <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={legendStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  {analytics.statusData.map((d) => (
                    <div key={d.name} className="rounded-lg bg-muted/40 p-2">
                      <div className="num text-lg font-extrabold" style={{ color: d.color }}>{d.value}</div>
                      <div className="text-[10px] text-muted-foreground">{d.name}</div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Occupancy gauge */}
              <Card className="p-5">
                <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold">
                  <Target className="h-4 w-4 text-accent" /> مؤشر الإشغال
                </h3>
                <div className="relative h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius="68%" outerRadius="100%" data={analytics.occupancyGauge} startAngle={210} endAngle={-30}>
                      <RadialBar background={{ fill: "hsl(var(--muted))" } as any} dataKey="value" cornerRadius={10} fill={C.primary} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="num font-display text-4xl font-extrabold text-primary">{stats.occupancy.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground">المستهدف {targetPct}%</div>
                    <div className="mt-1 text-[11px] font-medium text-muted-foreground">{fmt(stats.rented)} / {fmt(stats.total)} وحدة</div>
                  </div>
                </div>
              </Card>

              {/* Activity mix */}
              <Card className="p-5">
                <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold">
                  <Layers className="h-4 w-4 text-accent" /> توزيع الأنشطة
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <Pie
                        data={analytics.activityPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        outerRadius={90}
                        innerRadius={40}
                        labelLine={false}
                        label={(e: any) => {
                          const total = analytics.activityPie.reduce((s, x) => s + x.value, 0);
                          const pct = total ? Math.round((e.value / total) * 100) : 0;
                          const RADIAN = Math.PI / 180;
                          const r = e.innerRadius + (e.outerRadius - e.innerRadius) * 0.55;
                          const x = e.cx + r * Math.cos(-e.midAngle * RADIAN);
                          const y = e.cy + r * Math.sin(-e.midAngle * RADIAN);
                          return (
                            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700}>
                              {`${e.value} • ${pct}%`}
                            </text>
                          );
                        }}
                      >
                        {analytics.activityPie.map((d, i) => <Cell key={i} fill={d.color} stroke="white" strokeWidth={2} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip formatter={(v: any) => fmt(Number(v))} />} cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }} />
                      <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={legendStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Activity full breakdown */}
            <Card className="p-5">
              <h3 className="mb-3 font-display text-sm font-bold">حالة الوحدات حسب النشاط</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.activityData} margin={{ top: 10, right: 60, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} strokeOpacity={0.45} vertical={false} />
                    <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} tickMargin={8} />
                    <YAxis
                      orientation="right"
                      width={50}
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={12}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }} />
                    <Legend wrapperStyle={legendStyle} iconType="circle" />
                    <Bar dataKey="مؤجر" stackId="a" fill={STATUS_COLORS.rented} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="محجوز" stackId="a" fill={STATUS_COLORS.reserved} />
                    <Bar dataKey="متاح" stackId="a" fill={STATUS_COLORS.available} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </TabsContent>

          {/* FINANCIAL */}
          <TabsContent value="financial" dir="rtl" className="mt-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="overflow-hidden border-none p-5 text-white" style={{ background: "linear-gradient(135deg, hsl(152 60% 38%), hsl(152 55% 28%))" }}>
                <div className="text-xs opacity-90">الإيراد المحقق</div>
                <div className="num mt-1 font-display text-2xl font-extrabold sm:text-3xl">{fmt(stats.rentedRevenue)}</div>
                <div className="text-xs opacity-80">ر.س / سنة</div>
                <div className="mt-3 text-[11px] opacity-90">
                  {fmt(stats.rented)} وحدة مؤجرة بمساحة {fmt(stats.rentedArea)} م²
                </div>
              </Card>
              <Card className="overflow-hidden border-none p-5 text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
                <div className="text-xs opacity-90">الإيراد المحتمل (عند 100%)</div>
                <div className="num mt-1 font-display text-2xl font-extrabold sm:text-3xl">{fmt(stats.totalPotentialRevenue)}</div>
                <div className="text-xs opacity-80">ر.س / سنة</div>
                <div className="mt-3 text-[11px] opacity-90">
                  متوسط سعر المتر: {fmt(analytics.potentialPricePerSqm)} ر.س / م²
                </div>
              </Card>
              <Card className="overflow-hidden border-none p-5 text-accent-foreground" style={{ background: "var(--gradient-gold)" }}>
                <div className="text-xs opacity-80">الفجوة (إيراد متاح غير محقق)</div>
                <div className="num mt-1 font-display text-2xl font-extrabold sm:text-3xl">{fmt(stats.lostRevenue)}</div>
                <div className="text-xs opacity-70">ر.س / سنة</div>
                <div className="mt-3 text-[11px] opacity-80">
                  من {fmt(stats.available)} وحدة متاحة للحجز
                </div>
              </Card>
            </div>

            {/* Revenue per activity */}
            <Card className="p-5">
              <h3 className="mb-3 font-display text-sm font-bold">الإيراد المحقق مقابل الإمكانية حسب النشاط (ر.س / سنة)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={analytics.activityData}>
                    <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} strokeOpacity={0.45} vertical={false} />
                    <XAxis dataKey="name" tick={AXIS_TICK} tickLine={AXIS_LINE} axisLine={AXIS_LINE} />
                    <YAxis yAxisId="left" tick={AXIS_TICK} tickLine={AXIS_LINE} axisLine={AXIS_LINE} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} tickLine={AXIS_LINE} axisLine={AXIS_LINE} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                    <Tooltip content={<ChartTooltip formatter={(v: any, n: any) => n === "إشغال" ? `${v}%` : fmt(Number(v))} />} cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }} />
                    <Legend wrapperStyle={legendStyle} iconType="circle" />
                    <Bar yAxisId="left" dataKey="إيراد" fill={C.green} radius={[6, 6, 0, 0]} />
                    <Bar yAxisId="left" dataKey="إمكانية" fill={C.muted} radius={[6, 6, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="إشغال" stroke={C.gold} strokeWidth={3} dot={{ r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Per-building revenue */}
            <Card className="p-5">
              <h3 className="mb-3 font-display text-sm font-bold">الإيراد المحقق مقابل الفجوة لكل مبنى (ر.س / سنة)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[...analytics.buildingChart].reverse()}
                    margin={{ top: 24, right: 16, bottom: 8, left: 22 }}
                    barCategoryGap="18%"
                  >
                    <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} strokeOpacity={0.45} vertical={false} />
                    <XAxis
                      dataKey="name"
                      interval={0}
                      tick={AXIS_TICK}
                      tickLine={AXIS_LINE}
                      axisLine={AXIS_LINE}
                      tickFormatter={(value) => value.replace("م", "م ")}
                    />
                    <YAxis
                      width={66}
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tickFormatter={(v) => `${fmt(v / 1000)} ألف`}
                    />
                    <Tooltip content={<ChartTooltip formatter={(v: any) => `${fmt(Number(v))} ر.س`} />} cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }} />
                    <Legend wrapperStyle={legendStyle} iconType="circle" />
                    <Bar dataKey="إيراد" stackId="r" fill={C.green} maxBarSize={64} />
                    <Bar dataKey="فجوة" stackId="r" fill={C.red} radius={[6, 6, 0, 0]} maxBarSize={64}>
                      <LabelList
                        dataKey="إجمالي"
                        position="top"
                        formatter={(v: number) => `${fmt(v / 1000)}k`}
                        style={{ fill: "hsl(var(--foreground))", fontSize: 10, fontWeight: 700 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Price band histogram */}
            <Card className="p-5">
              <h3 className="mb-3 font-display text-sm font-bold">توزيع الوحدات حسب شريحة الإيجار السنوي</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.priceBands}>
                    <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} strokeOpacity={0.45} vertical={false} />
                    <XAxis dataKey="name" tick={AXIS_TICK} tickLine={AXIS_LINE} axisLine={AXIS_LINE} />
                    <YAxis tick={AXIS_TICK} tickLine={AXIS_LINE} axisLine={AXIS_LINE} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }} />
                    <Legend wrapperStyle={legendStyle} iconType="circle" />
                    <Bar dataKey="وحدات" fill={C.primary} radius={[6, 6, 0, 0]}>
                      <LabelList dataKey="وحدات" position="top" style={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                    </Bar>
                    <Bar dataKey="مؤجر" fill={C.gold} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </TabsContent>

          {/* BUILDINGS */}
          <TabsContent value="buildings" dir="rtl" className="mt-5 space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-3 font-display text-sm font-bold">إشغال كل مبنى (%)</h3>
                <div className="h-[430px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.buildingChart}
                      layout="vertical"
                      margin={{ top: 44, right: 90, bottom: 16, left: 40 }}
                      barCategoryGap="28%"
                    >
                      <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} strokeOpacity={0.45} horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        orientation="top"
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={12}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        orientation="right"
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={16}
                        width={56}
                        tickFormatter={(value) => value.replace("م", "م ")}
                      />
                      <Tooltip content={<ChartTooltip formatter={(v: any) => `${v}%`} />} cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }} />
                      <Bar dataKey="إشغال" fill={C.primary} radius={[6, 0, 0, 6]} maxBarSize={24}>
                        <LabelList
                          dataKey="إشغال"
                          content={({ x, y, width, height, value }: any) => (
                            <text
                              x={Number(x) + Number(width) + 10}
                              y={Number(y) + Number(height) / 2}
                              dominantBaseline="middle"
                              textAnchor="start"
                              fill="hsl(var(--foreground))"
                              fontSize={11}
                              fontWeight={700}
                            >
                              {value}%
                            </text>
                          )}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="mb-3 font-display text-sm font-bold">توزيع الوحدات في المباني</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.buildingChart}>
                      <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} strokeOpacity={0.45} vertical={false} />
                      <XAxis dataKey="name" tick={AXIS_TICK} tickLine={AXIS_LINE} axisLine={AXIS_LINE} />
                      <YAxis tick={AXIS_TICK} tickLine={AXIS_LINE} axisLine={AXIS_LINE} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }} />
                      <Legend wrapperStyle={legendStyle} iconType="circle" />
                      <Bar dataKey="مؤجر" stackId="a" fill={STATUS_COLORS.rented} />
                      <Bar dataKey="محجوز" stackId="a" fill={STATUS_COLORS.reserved} />
                      <Bar dataKey="متاح" stackId="a" fill={STATUS_COLORS.available} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <Card className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-sm font-bold">أداء المباني بالتفصيل</h3>
                <span className="text-xs text-muted-foreground">{buildings.length} مبنى</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {buildings.map((b) => {
                  const bUnits = units.filter((u) => u.buildingNumber === b.number);
                  const rented = bUnits.filter((u) => u.status === "rented").length;
                  const reserved = bUnits.filter((u) => u.status === "reserved").length;
                  const total = bUnits.length;
                  const free = total - rented - reserved;
                  const pct = total ? (rented / total) * 100 : 0;
                  const tone = pct >= 60 ? "from-emerald-500 to-emerald-400" : pct >= 30 ? "from-amber-500 to-amber-400" : "from-rose-500 to-rose-400";
                  const revenue = bUnits.filter((u) => u.status === "rented").reduce((s, u) => s + Number(u.price), 0);
                  const potential = bUnits.reduce((s, u) => s + Number(u.price), 0);
                  return (
                    <div key={b.number} className="group rounded-xl border bg-gradient-to-b from-muted/20 to-card p-4 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-card">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <div className="font-display text-sm font-bold">مبنى <span className="num">{b.number}</span></div>
                        <Badge variant="outline" className="text-[10px]">{b.type}</Badge>
                      </div>
                      <div className="mb-3 grid grid-cols-4 gap-1.5 text-center">
                        <div className="rounded-md bg-muted/50 p-1.5">
                          <div className="num text-base font-extrabold">{total}</div>
                          <div className="text-[9px] text-muted-foreground">إجمالي</div>
                        </div>
                        <div className="rounded-md bg-primary/10 p-1.5">
                          <div className="num text-base font-extrabold text-primary">{rented}</div>
                          <div className="text-[9px] text-muted-foreground">مؤجر</div>
                        </div>
                        <div className="rounded-md bg-amber-500/10 p-1.5">
                          <div className="num text-base font-extrabold text-amber-700">{reserved}</div>
                          <div className="text-[9px] text-muted-foreground">محجوز</div>
                        </div>
                        <div className="rounded-md bg-emerald-500/10 p-1.5">
                          <div className="num text-base font-extrabold text-emerald-700">{free}</div>
                          <div className="text-[9px] text-muted-foreground">متاح</div>
                        </div>
                      </div>
                      <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full bg-gradient-to-l transition-all duration-700", tone)} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold">إشغال {pct.toFixed(0)}%</span>
                        <span className="num font-semibold text-emerald-700">{fmt(revenue)} ر.س</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>إمكانية</span>
                        <span className="num">{fmt(potential)} ر.س</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          {/* ANALYTICS */}
          <TabsContent value="analytics" dir="rtl" className="mt-5 space-y-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-3 font-display text-sm font-bold">توزيع الوحدات حسب المساحة (م²)</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.areaBands}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.primary} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={C.primary} stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} strokeOpacity={0.45} vertical={false} />
                      <XAxis dataKey="name" tick={AXIS_TICK} tickLine={AXIS_LINE} axisLine={AXIS_LINE} />
                      <YAxis tick={AXIS_TICK} tickLine={AXIS_LINE} axisLine={AXIS_LINE} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }} />
                      <Area type="monotone" dataKey="وحدات" stroke={C.primary} fill="url(#areaGrad)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="mb-3 font-display text-sm font-bold">توزيع نوع الوحدات</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                      <Pie
                        data={analytics.unitTypeData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        outerRadius={90}
                        innerRadius={50}
                        labelLine={false}
                        label={({ cx, cy, midAngle, innerRadius, outerRadius, value, name, percent }: any) => {
                          const RAD = Math.PI / 180;
                          const r = innerRadius + (outerRadius - innerRadius) * 0.5;
                          const x = cx + r * Math.cos(-midAngle * RAD);
                          const y = cy + r * Math.sin(-midAngle * RAD);
                          if (percent < 0.06) return null;
                          return (
                            <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 12, fontWeight: 700 }}>
                              <tspan x={x} dy="-0.4em">{name}</tspan>
                              <tspan x={x} dy="1.2em">{value}</tspan>
                            </text>
                          );
                        }}
                      >
                        {analytics.unitTypeData.map((d, i) => <Cell key={i} fill={d.color} stroke="white" strokeWidth={2} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }} />
                      <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={legendStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Building leaderboard */}
            <Card className="p-5">
              <h3 className="mb-3 font-display text-sm font-bold">ترتيب المباني بالإيراد المحقق (Top 8)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.buildingLeaders} layout="vertical" margin={{ top: 10, right: 70, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke={GRID_STROKE} strokeOpacity={0.45} vertical={false} />
                    <XAxis type="number" tick={AXIS_TICK} tickLine={AXIS_LINE} axisLine={AXIS_LINE} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15 / 10000) * 10000]} />
                    <YAxis dataKey="name" type="category" orientation="right" tick={AXIS_TICK} tickLine={AXIS_LINE} axisLine={AXIS_LINE} width={80} />
                    <Tooltip content={<ChartTooltip formatter={(v: any) => fmt(Number(v))} />} cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }} />
                    <Bar dataKey="إيراد" fill={C.green} radius={[6, 0, 0, 6]}>
                      <LabelList dataKey="إيراد" position="right" formatter={(v: any) => fmt(Number(v))} style={{ fontSize: 11, fontWeight: 700, fill: "hsl(var(--foreground))" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {analytics.topTenants.length > 0 && (
              <Card className="p-5">
                <h3 className="mb-3 font-display text-sm font-bold">أكبر المستأجرين (حسب عدد الوحدات)</h3>
                <div className="space-y-4" dir="rtl">
                  {analytics.topTenants.map((tenant, index) => {
                    const maxUnits = Math.max(...analytics.topTenants.map((item) => item.وحدات), 1);
                    const width = Math.max((tenant.وحدات / maxUnits) * 100, 8);
                    return (
                      <div key={`${tenant.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_3rem] gap-x-3 gap-y-2">
                        <div className="min-w-0 text-right text-sm font-semibold leading-6 text-foreground">
                          {tenant.name}
                        </div>
                        <div className="num row-span-2 flex h-7 items-center justify-center self-end rounded-md bg-secondary text-sm font-extrabold text-secondary-foreground">
                          {tenant.وحدات}
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-sm bg-muted" aria-hidden="true">
                          <div
                            className="h-full rounded-sm bg-primary transition-[width] duration-500"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* TENANTS */}
          <TabsContent value="tenants" dir="rtl" className="mt-5 space-y-5">
            {tenants.length === 0 ? (
              <Card className="p-10 text-center text-muted-foreground">لا يوجد مستأجرون بعد</Card>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground">عدد المستأجرين</div>
                    <div className="num mt-2 font-display text-2xl font-extrabold">{tenants.length}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground">إجمالي الوحدات المؤجرة</div>
                    <div className="num mt-2 font-display text-2xl font-extrabold">{tenants.reduce((s, t) => s + t.units.length, 0)}</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground">متوسط الوحدات لكل مستأجر</div>
                    <div className="num mt-2 font-display text-2xl font-extrabold">
                      {(tenants.reduce((s, t) => s + t.units.length, 0) / Math.max(1, tenants.length)).toFixed(1)}
                    </div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-xs text-muted-foreground">مستأجرون بأكثر من وحدة</div>
                    <div className="num mt-2 font-display text-2xl font-extrabold">
                      {tenants.filter((t) => t.units.length > 1).length}
                    </div>
                  </Card>
                </div>

                <Card className="p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                    <h2 className="flex items-center gap-2 font-display text-base font-bold">
                      <Users className="h-5 w-5 text-accent" /> قائمة المستأجرين
                    </h2>
                    <Badge variant="secondary">{tenants.length} مستأجر</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {tenants
                      .slice()
                      .sort((a, b) => b.units.length - a.units.length)
                      .map((t) => (
                        <div key={t.id} className="rounded-xl border bg-gradient-to-b from-muted/20 to-card p-4 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-card">
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="font-display text-sm font-bold text-foreground">{t.tenant_name}</div>
                            <Badge className="num bg-primary/10 text-primary hover:bg-primary/15">{t.units.length} وحدة</Badge>
                          </div>
                          {(t.business_name || t.activity_type) && (
                            <div className="mb-2 text-[11px] text-muted-foreground">
                              {[t.business_name, t.activity_type].filter(Boolean).join(" · ")}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {t.units
                              .sort((a, b) => a.building_number - b.building_number || a.unit_number - b.unit_number)
                              .map((u, i) => (
                                <span key={i} className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px]" title={u.activity ?? ""}>
                                  م<span className="num font-semibold">{u.building_number}</span> · و<span className="num font-bold">{u.unit_number}</span>
                                </span>
                              ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </Card>
              </>
            )}
          </TabsContent>

          {/* MAP */}
          <TabsContent value="map" dir="rtl" className="mt-5 space-y-4">
            <UnitsMap buildings={buildings} units={units} />
          </TabsContent>

          {/* UNITS */}
          <TabsContent value="units" dir="rtl" className="mt-5 space-y-4">
            <Card className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                <h2 className="flex items-center gap-2 font-display text-base font-bold">
                  <Package className="h-5 w-5 text-accent" /> تفاصيل الوحدات
                </h2>
                <Badge variant="secondary">{fmt(filteredUnits.length)} / {fmt(stats.total)}</Badge>
              </div>

              {/* Filters */}
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={unitSearch}
                    onChange={(e) => setUnitSearch(e.target.value)}
                    placeholder="بحث: مبنى, وحدة, نشاط, مستأجر…"
                    className="pr-9"
                  />
                </div>
                <select
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value as FilterKey)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">كل الحالات</option>
                  <option value="rented">مؤجر</option>
                  <option value="reserved">محجوز</option>
                  <option value="available">متاح</option>
                </select>
                <select
                  value={unitTypeFilter}
                  onChange={(e) => setUnitTypeFilter(e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">كل الأنواع</option>
                  <option value="ركنية">ركنية</option>
                  <option value="داخلية">داخلية</option>
                </select>
                <select
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">كل الأنشطة</option>
                  {activityOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {/* Table */}
              <div className="overflow-hidden rounded-lg border" dir="rtl">
                <div className="overflow-x-auto">
                  <div className="min-w-[820px]">
                    <div
                      className="grid items-center gap-3 bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground"
                      style={{ gridTemplateColumns: "70px 100px 90px 100px minmax(160px,1fr) 140px 100px" }}
                    >
                      <div className="text-right">المبنى</div>
                      <div className="text-right">رقم الوحدة</div>
                      <div className="text-right">النوع</div>
                      <div className="text-right">المساحة</div>
                      <div className="text-right">النشاط</div>
                      <div className="text-right">الإيجار / سنة</div>
                      <div className="text-right">الحالة</div>
                    </div>
                    <div className="divide-y divide-border bg-card">
                      {pagedUnits.map((u, idx) => (
                        <div
                          key={`${u.buildingNumber}-${u.unitNumber}`}
                          className={cn(
                            "grid items-center gap-3 px-4 py-2.5 text-xs transition hover:bg-muted/40",
                            idx % 2 === 0 && "bg-muted/10",
                          )}
                          style={{ gridTemplateColumns: "70px 100px 90px 100px minmax(160px,1fr) 140px 100px" }}
                        >
                          <div className="num text-right font-medium">{u.buildingNumber}</div>
                          <div className="num text-right font-bold">{u.unitNumber}</div>
                          <div className="text-right">
                            {u.unitType ? (
                              <Badge variant="outline" className="text-[10px]">{u.unitType}</Badge>
                            ) : "—"}
                          </div>
                          <div className="num text-right">{u.area} م²</div>
                          <div className="truncate text-right" title={u.activity ?? ""}>{u.activity ?? "—"}</div>
                          <div className="num text-right font-semibold">{fmt(u.price)} ر.س</div>
                          <div className="text-right">
                            <span className={cn(
                              "inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              u.status === "rented" && "bg-primary/10 text-primary",
                              u.status === "reserved" && "bg-amber-500/15 text-amber-700",
                              u.status === "available" && "bg-emerald-500/15 text-emerald-700",
                            )}>
                              {u.status === "rented" ? "مؤجر" : u.status === "reserved" ? "محجوز" : "متاح"}
                            </span>
                          </div>
                        </div>
                      ))}
                      {pagedUnits.length === 0 && (
                        <div className="px-4 py-10 text-center text-muted-foreground">لا توجد نتائج مطابقة</div>
                      )}
                    </div>
                  </div>
                </div>
                {/* Pagination */}
                {pageCount > 1 && (
                  <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-3 text-xs">
                    <span className="text-muted-foreground">
                      صفحة <span className="num font-bold text-foreground">{unitPage}</span> من <span className="num font-bold text-foreground">{pageCount}</span> · {fmt(filteredUnits.length)} وحدة
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setUnitPage((p) => Math.max(1, p - 1))}
                        disabled={unitPage === 1}
                        className="rounded-md border bg-background px-3 py-1 font-medium disabled:opacity-40 hover:border-accent"
                      >السابق</button>
                      <button
                        onClick={() => setUnitPage((p) => Math.min(pageCount, p + 1))}
                        disabled={unitPage === pageCount}
                        className="rounded-md border bg-background px-3 py-1 font-medium disabled:opacity-40 hover:border-accent"
                      >التالي</button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
