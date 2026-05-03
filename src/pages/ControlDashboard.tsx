import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Search,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type UnitRow = {
  id: string;
  building_number: number;
  unit_number: number;
  unit_type: string | null;
  activity: string | null;
  area: number;
  price: number;
  status: string;
  updated_at: string;
};

type StatusKey = "available" | "rented" | "reserved" | "maintenance";

const STATUS_META: Record<
  StatusKey,
  { label: string; cls: string; dot: string; Icon: typeof CheckCircle2 }
> = {
  available: {
    label: "متاحة",
    cls: "bg-green-50 text-green-700 border-green-200",
    dot: "bg-green-500",
    Icon: CheckCircle2,
  },
  rented: {
    label: "مؤجرة",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
    Icon: Clock,
  },
  reserved: {
    label: "محجوزة",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    Icon: Clock,
  },
  maintenance: {
    label: "تحت الصيانة",
    cls: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
    Icon: Wrench,
  },
};

const FILTERS: { key: "all" | StatusKey; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "available", label: "متاحة" },
  { key: "maintenance", label: "تحت الصيانة" },
  { key: "rented", label: "مؤجرة" },
  { key: "reserved", label: "محجوزة" },
];

const ControlDashboard = () => {
  const { user, loading: authLoading, isControl, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<"all" | StatusKey>("all");
  const [building, setBuilding] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "لوحة الكنترول | نخبة تسكين";
  }, []);

  // Access guard
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!isControl && !isAdmin) {
      navigate("/profile");
    }
  }, [authLoading, user, isControl, isAdmin, navigate]);

  const { data: units = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["control-units"],
    enabled: !!user && (isControl || isAdmin),
    queryFn: async (): Promise<UnitRow[]> => {
      const { data, error } = await supabase
        .from("units")
        .select(
          "id,building_number,unit_number,unit_type,activity,area,price,status,updated_at",
        )
        .order("building_number")
        .order("unit_number")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as UnitRow[];
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("control:units")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "units" },
        () => queryClient.invalidateQueries({ queryKey: ["control-units"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const buildings = useMemo(
    () => Array.from(new Set(units.map((u) => u.building_number))).sort((a, b) => a - b),
    [units],
  );

  const stats = useMemo(() => {
    const total = units.length;
    const maintenance = units.filter((u) => u.status === "maintenance").length;
    const available = units.filter((u) => u.status === "available").length;
    const rented = units.filter((u) => u.status === "rented").length;
    const reserved = units.filter((u) => u.status === "reserved").length;
    return { total, maintenance, available, rented, reserved };
  }, [units]);

  const filtered = useMemo(() => {
    return units.filter((u) => {
      if (filter !== "all" && u.status !== filter) return false;
      if (building !== "all" && u.building_number !== building) return false;
      if (search.trim()) {
        const q = search.trim();
        const hay = `${u.building_number} ${u.unit_number} ${u.activity ?? ""} ${u.unit_type ?? ""}`;
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [units, filter, building, search]);

  const updateStatus = async (unit: UnitRow, next: StatusKey) => {
    if (unit.status === next) return;
    setUpdatingId(unit.id);
    const { error } = await supabase
      .from("units")
      .update({ status: next })
      .eq("id", unit.id);
    setUpdatingId(null);
    if (error) {
      toast.error("تعذّر تحديث الحالة: " + error.message);
      return;
    }
    toast.success(
      `تم تحديث الوحدة ${unit.building_number}-${unit.unit_number} إلى "${STATUS_META[next].label}"`,
    );
    queryClient.invalidateQueries({ queryKey: ["control-units"] });
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container-tight flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="border-b bg-gradient-to-br from-red-600 via-red-500 to-orange-500 text-white">
        <div className="container-tight flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-xl font-extrabold sm:text-2xl">
                لوحة الكنترول والصيانة
              </h1>
              <p className="text-xs opacity-90 sm:text-sm">
                متابعة حالة الوحدات وإدارة طلبات الصيانة
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 self-start rounded-lg bg-white/15 px-3 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/25 disabled:opacity-50 sm:self-auto"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            تحديث
          </button>
        </div>
      </section>

      <main className="container-tight space-y-6 py-6">
        {/* KPI cards */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard label="إجمالي الوحدات" value={stats.total} Icon={Building2} tone="navy" />
          <KpiCard
            label="تحت الصيانة"
            value={stats.maintenance}
            Icon={Wrench}
            tone="red"
            highlight
          />
          <KpiCard label="متاحة" value={stats.available} Icon={CheckCircle2} tone="green" />
          <KpiCard label="مؤجرة" value={stats.rented} Icon={Clock} tone="blue" />
          <KpiCard label="محجوزة" value={stats.reserved} Icon={AlertTriangle} tone="amber" />
        </section>

        {/* Filters */}
        <section className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition",
                    filter === f.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/40",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={building}
                onChange={(e) =>
                  setBuilding(e.target.value === "all" ? "all" : Number(e.target.value))
                }
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              >
                <option value="all">كل المباني</option>
                {buildings.map((b) => (
                  <option key={b} value={b}>
                    مبنى {b}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث برقم وحدة / نشاط..."
                  className="w-full rounded-lg border border-border bg-background py-2 pr-9 pl-3 text-sm focus:border-primary focus:outline-none sm:w-56"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Units grid */}
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center justify-between border-b pb-3">
            <h2 className="font-display text-base font-bold">الوحدات</h2>
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {filtered.length} وحدة
            </span>
          </div>

          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              لا توجد وحدات تطابق التصفية الحالية.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((u) => {
                const status = (
                  STATUS_META[u.status as StatusKey] ?? STATUS_META.available
                );
                const isUpdating = updatingId === u.id;
                return (
                  <div
                    key={u.id}
                    className={cn(
                      "rounded-xl border bg-card p-4 transition hover:shadow-md",
                      u.status === "maintenance" && "border-red-300 bg-red-50/40",
                    )}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <div className="font-display text-sm font-bold">
                          مبنى{" "}
                          <span className="num">{u.building_number}</span>
                          {" · "}وحدة{" "}
                          <span className="num">{u.unit_number}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {u.activity || "—"} · {u.unit_type || "—"} ·{" "}
                          <span className="num">{u.area}</span> م²
                        </div>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          status.cls,
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-1.5">
                      {(Object.keys(STATUS_META) as StatusKey[]).map((k) => {
                        const meta = STATUS_META[k];
                        const active = u.status === k;
                        return (
                          <button
                            key={k}
                            disabled={isUpdating || active}
                            onClick={() => updateStatus(u, k)}
                            className={cn(
                              "inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition",
                              active
                                ? "cursor-default border-foreground/20 bg-foreground/5 text-foreground opacity-70"
                                : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-secondary",
                              isUpdating && "opacity-50",
                            )}
                            title={meta.label}
                          >
                            {isUpdating ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <meta.Icon className="h-3 w-3" />
                            )}
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-2 text-[10px] text-muted-foreground">
                      آخر تحديث:{" "}
                      <span className="num">
                        {new Date(u.updated_at).toLocaleString("ar-SA-u-nu-latn")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

const KpiCard = ({
  label,
  value,
  Icon,
  tone,
  highlight,
}: {
  label: string;
  value: number;
  Icon: typeof CheckCircle2;
  tone: "navy" | "red" | "green" | "blue" | "amber";
  highlight?: boolean;
}) => {
  const tones: Record<string, string> = {
    navy: "border-t-primary [&_.icon]:bg-primary/10 [&_.icon]:text-primary",
    red: "border-t-red-600 [&_.icon]:bg-red-100 [&_.icon]:text-red-700",
    green: "border-t-green-600 [&_.icon]:bg-green-100 [&_.icon]:text-green-700",
    blue: "border-t-blue-700 [&_.icon]:bg-blue-100 [&_.icon]:text-blue-700",
    amber: "border-t-amber-600 [&_.icon]:bg-amber-100 [&_.icon]:text-amber-700",
  };
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-t-4 bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        tones[tone],
        highlight && "ring-2 ring-red-200",
      )}
    >
      <div className="icon absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="num mt-1.5 font-display text-2xl font-extrabold leading-none">
        {value}
      </div>
    </div>
  );
};

export default ControlDashboard;
