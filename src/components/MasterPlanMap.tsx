import { useMemo } from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import masterPlanAsset from "@/assets/master-plan-full.webp.asset.json";
import { MASTER_PLAN_SIZE, MASTER_PLAN_SPOTS, masterPlanBuildingState } from "@/lib/masterPlan";
import type { Building, Unit } from "@/data/types";
import { cn } from "@/lib/utils";

interface MasterPlanMapProps {
  buildings: Building[];
  units: Unit[];
  loading?: boolean;
}

/** Full project master plan with one button on every building that opens its units. */
export function MasterPlanMap({ buildings, units, loading }: MasterPlanMapProps) {
  const states = useMemo(
    () => new Map(MASTER_PLAN_SPOTS.map((spot) => [spot.number, masterPlanBuildingState(spot.number, buildings, units)])),
    [buildings, units],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/50 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2 text-sm font-bold">
          <MapPin className="h-4 w-4 text-accent" />
          الماستر بلان الشامل للمشروع
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground sm:text-xs">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-primary" />فيه وحدات متاحة</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-muted-foreground" />مكتمل حاليًا</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-dashed border-muted-foreground bg-background" />قريبًا</span>
        </div>
      </div>
      <p className="px-4 pt-3 text-xs text-muted-foreground sm:px-5 sm:text-sm">اضغط على رقم أي مبنى عشان تشوف وحداته وتحجز.<span className="lg:hidden"> اسحب المخطط يمين وشمال لباقي المباني.</span></p>

      <div className="overflow-x-auto p-2 sm:p-4" dir="ltr">
        <div className="relative min-w-[960px]" style={{ aspectRatio: `${MASTER_PLAN_SIZE.width} / ${MASTER_PLAN_SIZE.height}` }}>
          <img
            src={masterPlanAsset.url}
            width={MASTER_PLAN_SIZE.width}
            height={MASTER_PLAN_SIZE.height}
            alt="الماستر بلان الشامل للمدينة الصناعية بشمال مكة المكرمة بأرقام المباني"
            className="absolute inset-0 h-full w-full select-none"
            loading="lazy"
            decoding="async"
            draggable={false}
          />
          {MASTER_PLAN_SPOTS.map((spot) => {
            const state = states.get(spot.number)!;
            const open = !!state.href;
            const full = open && state.available === 0;
            const label = open
              ? `المبنى ${spot.number} — ${state.activityTitle}${full ? " — مكتمل حاليًا" : ` — ${state.available} وحدة متاحة`}`
              : `المبنى ${spot.number} — قريبًا`;
            const pin = (
              <span
                className={cn(
                  "pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-extrabold tabular-nums shadow-md ring-2 transition-transform group-hover:scale-110 group-focus-visible:scale-110 lg:h-7 lg:min-w-7 lg:text-sm",
                    open && !full && "bg-primary text-primary-foreground ring-background",
                    full && "bg-muted-foreground text-background ring-background",
                    !open && "border border-dashed border-muted-foreground bg-background/90 text-muted-foreground ring-transparent",
                  )}
                >
                  {spot.number}
                </span>
                {open && !full && !loading && spot.w >= 10 && (
                  <span dir="rtl" className="whitespace-nowrap rounded-full bg-background/95 px-1.5 py-0.5 text-[10px] font-bold text-primary shadow-sm tabular-nums">
                    {state.available} متاحة
                  </span>
                )}
              </span>
            );
            const style = { left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, height: `${spot.h}%` };
            return open ? (
              <Link
                key={spot.number}
                to={state.href!}
                title={label}
                aria-label={label}
                style={style}
                className="group absolute rounded-md outline-none ring-primary transition hover:bg-primary/15 hover:ring-2 focus-visible:bg-primary/15 focus-visible:ring-2"
              >
                {pin}
              </Link>
            ) : (
              <span key={spot.number} title={label} aria-label={label} role="img" style={style} className="group absolute">
                {pin}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
