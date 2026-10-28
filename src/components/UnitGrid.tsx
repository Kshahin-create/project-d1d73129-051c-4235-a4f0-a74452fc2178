import { motion, AnimatePresence } from "framer-motion";
import { Lock, CheckCircle2, ZoomIn, X } from "lucide-react";
import { useState } from "react";
import type { Unit } from "@/data/types";
import { cn } from "@/lib/utils";
import { getPlanLayout, EXTRA_SECTIONS, type PlanLayout } from "@/data/buildingPlans";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface UnitGridProps {
  buildingNumber: number;
  units: Unit[];
  /** Selected unit numbers (multi-select). */
  selectedUnits?: number[];
  onSelect: (unit: Unit) => void;
  /** Optional building plan image. Add PNGs to src/assets/plans/ as building-{n}.png */
  planImage?: string;
}

const sectionImages = import.meta.glob("@/assets/plans/section-*.svg", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const sectionImage = (key: string) =>
  Object.entries(sectionImages).find(([k]) => k.endsWith(`section-${key}.svg`))?.[1];

export const UnitGrid = (props: UnitGridProps) => {
  const extras = EXTRA_SECTIONS[props.buildingNumber] ?? [];
  if (extras.length === 0) return <UnitGridSection {...props} />;
  const usedNumbers = new Set(extras.flatMap((s) => s.layout.units.map((u) => u.unitNumber)));
  const mainUnits = props.units.filter((u) => !usedNumbers.has(u.unitNumber));
  return (
    <div className="space-y-10">
      {mainUnits.length > 0 && <section className="space-y-3">
        <h3 className="font-display text-lg font-bold">مبنى {props.buildingNumber} - أ</h3>
        <UnitGridSection {...props} units={mainUnits} />
      </section>}
      {extras.map((s) => {
        const nums = new Set(s.layout.units.map((u) => u.unitNumber));
        return (
          <section key={s.key} className="space-y-3">
            <h3 className="font-display text-lg font-bold">{s.label}</h3>
            <UnitGridSection
              {...props}
              units={props.units.filter((u) => nums.has(u.unitNumber))}
              planImage={sectionImage(s.key)}
              layoutOverride={s.layout}
              planLabel={s.label}
            />
          </section>
        );
      })}
    </div>
  );
};

const UnitGridSection = ({
  buildingNumber,
  units,
  selectedUnits = [],
  onSelect,
  planImage,
  layoutOverride,
  planLabel,
}: UnitGridProps & { layoutOverride?: PlanLayout; planLabel?: string }) => {
  const [zoomed, setZoomed] = useState(false);
  const [hoveredUnit, setHoveredUnit] = useState<number | null>(null);
  const { isAdmin, isManager, isControl } = useAuth();
  const canDistinguish = isAdmin || isManager || isControl;
  const layout = layoutOverride ?? getPlanLayout(buildingNumber);
  const unitsByNumber = new Map(units.map((u) => [u.unitNumber, u]));
  const selectedSet = new Set(selectedUnits);
  const displayLabel = planLabel ?? `مبنى ${buildingNumber}${buildingNumber === 15 ? " - ب" : ""}`;

  const renderOverlay = (interactive: boolean) =>
    layout?.units.map((area) => {
      const unit = unitsByNumber.get(area.unitNumber);
      if (!unit) return null;
      const rawRented = unit.status === "rented";
      const rawReserved = unit.status === "reserved";
      const isRented = canDistinguish ? rawRented : (rawRented || rawReserved);
      const isReserved = canDistinguish ? rawReserved : false;
      const isLocked = rawRented || rawReserved;
      const isSelected = selectedSet.has(unit.unitNumber);
      const isHovered = hoveredUnit === unit.unitNumber;

      const ringColor = isRented
        ? "hsl(var(--destructive))"
          : isReserved
            ? "hsl(var(--primary))"
          : isSelected
            ? "hsl(var(--accent))"
            : "transparent";

      return (
        <Button
          key={area.unitNumber}
          type="button"
          disabled={isLocked || !interactive}
          onClick={() => interactive && onSelect(unit)}
          onMouseEnter={() => interactive && setHoveredUnit(unit.unitNumber)}
          onMouseLeave={() => interactive && setHoveredUnit(null)}
          aria-label={`وحدة ${area.unitNumber}${isRented ? " (مؤجرة)" : isReserved ? " (محجوزة)" : ""}`}
          className={cn(
            "absolute box-border flex min-h-0 items-center justify-center rounded-none border-0 bg-transparent p-0 text-[10px] font-bold transition-colors duration-200 sm:text-xs",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-accent",
            isRented && "cursor-not-allowed bg-destructive/55 text-primary-foreground",
            isReserved && "cursor-not-allowed bg-primary/55 text-primary-foreground",
            !isLocked && !isSelected &&
              "bg-transparent text-transparent hover:bg-accent/25 hover:text-accent-foreground",
            !isLocked && isSelected && "bg-accent/55 text-accent-foreground",
            isHovered && !isSelected && !isLocked && "z-10"
          )}
          style={{
            left: `${area.x}%`,
            top: `${area.y}%`,
            width: `${area.w}%`,
            height: `${area.h}%`,
            boxShadow: ringColor === "transparent" ? undefined : `inset 0 0 0 1px ${ringColor}`,
          }}
        >
          <span className="num drop-shadow-sm">{area.unitNumber}</span>
        </Button>
      );
    });

  return (
    <div className="space-y-6">
      {/* Plan image with interactive overlay */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {planImage ? (
          <>
            <div
              className="relative mx-auto"
              style={
                layout
                  ? {
                      aspectRatio: String(layout.aspectRatio),
                      width: "100%",
                      maxWidth: `calc(520px * ${layout.aspectRatio})`,
                    }
                  : { width: "100%" }
              }
            >
              <img
                src={planImage}
                alt={`مخطط ${displayLabel}`}
                className="block h-full w-full object-fill bg-secondary"
              />
              {/* Interactive unit overlay */}
              {layout && (
                <div className="absolute inset-0" aria-hidden={false}>
                  {renderOverlay(true)}
                </div>
              )}
            </div>

            <Button
              onClick={() => setZoomed(true)}
              className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-primary/90 px-3 py-1.5 text-xs font-medium text-primary-foreground backdrop-blur-sm hover:bg-primary"
            >
              <ZoomIn className="h-3.5 w-3.5" /> تكبير المخطط
            </Button>

            {/* Hint */}
            {layout && (
              <div className="hidden sm:block absolute right-3 top-3 z-20 rounded-full bg-card/90 px-3 py-1.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm sm:text-xs">
                اضغط على الوحدة في المخطط لاختيارها
              </div>
            )}
          </>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center gap-2 bg-secondary text-muted-foreground">
            <p className="text-sm">
              مخطط {displayLabel} غير متاح حاليًا
            </p>
            <p className="text-xs">
              يمكنك اختيار الوحدات من القائمة أدناه.
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
        <LegendDot colorClass="bg-card border-2 border-border" label="متاح" />
        <LegendDot colorClass="bg-accent border-2 border-accent" label="مختار" />
        {canDistinguish && (
          <LegendDot colorClass="bg-primary/40 border-2 border-primary/70" label="محجوز" icon={<Lock className="h-3 w-3" />} />
        )}
        <LegendDot colorClass="bg-destructive/40 border-2 border-destructive/70" label={canDistinguish ? "مؤجر" : "غير متاح"} icon={<Lock className="h-3 w-3" />} />
      </div>

      {/* Units grid (alternative quick selection) */}
      <div>
        <h4 className="mb-3 font-display font-bold">أو اختر رقم الوحدة من القائمة</h4>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {units.map((u) => {
            const rawRented = u.status === "rented";
            const rawReserved = u.status === "reserved";
            const isRented = canDistinguish ? rawRented : (rawRented || rawReserved);
            const isReserved = canDistinguish ? rawReserved : false;
            const isLocked = rawRented || rawReserved;
            const isSelected = selectedSet.has(u.unitNumber);
            const isCorner = u.unitType === "ركنية";
            return (
              <motion.button
                key={u.unitNumber}
                whileHover={!isLocked ? { scale: 1.05 } : undefined}
                whileTap={!isLocked ? { scale: 0.96 } : undefined}
                disabled={isLocked}
                onClick={() => onSelect(u)}
                className={cn(
                  "group relative flex h-auto w-full aspect-square flex-col items-center justify-center rounded-xl border-2 p-1 text-center transition-all",
                  isRented &&
                    "cursor-not-allowed border-destructive/40 bg-destructive/10 opacity-80",
                  isReserved &&
                    "cursor-not-allowed border-primary/40 bg-primary/10 opacity-80",
                  !isLocked && !isSelected &&
                    "border-border bg-card hover:border-primary hover:shadow-card",
                  isSelected &&
                    "border-primary bg-primary text-primary-foreground shadow-elevated"
                )}
              >
                {isCorner && !isLocked && (
                  <span className="absolute right-1 top-1 rounded-full bg-accent px-1.5 py-0.5 text-[8px] font-bold text-accent-foreground">
                    ركنية
                  </span>
                )}
                <div className={cn("font-display font-extrabold num text-lg sm:text-xl", isSelected ? "text-primary-foreground" : "text-foreground")}>
                  {u.unitNumber}
                </div>
                <div className={cn("text-[10px] font-medium num mt-0.5", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {u.area} م²
                </div>
                {isRented ? (
                  <div className="mt-1 flex items-center gap-0.5 text-[9px] font-bold text-destructive">
                    <Lock className="h-2.5 w-2.5" /> {canDistinguish ? "مؤجر" : "غير متاح"}
                  </div>
                ) : isReserved ? (
                  <div className="mt-1 flex items-center gap-0.5 text-[9px] font-bold text-primary">
                    <Lock className="h-2.5 w-2.5" /> محجوز
                  </div>
                ) : isSelected ? (
                  <CheckCircle2 className="mt-1 h-3.5 w-3.5 text-primary-foreground" />
                ) : null}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {zoomed && planImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomed(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-primary/95 p-4 backdrop-blur-sm"
          >
            <Button
              aria-label="إغلاق المخطط"
              onClick={() => setZoomed(false)}
              className="absolute left-4 top-4 z-10 rounded-full bg-background/10 p-2 text-primary-foreground hover:bg-background/20"
            >
              <X className="h-5 w-5" />
            </Button>
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-full max-w-full"
            >
              <img
                src={planImage}
                alt={`مخطط ${displayLabel}`}
                className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain shadow-elevated"
              />
              {layout && (
                <div className="absolute inset-0">
                  {renderOverlay(true)}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LegendDot = ({ colorClass, label, icon }: { colorClass: string; label: string; icon?: React.ReactNode }) => (
  <div className="flex items-center gap-2">
    <div className={cn("flex h-5 w-5 items-center justify-center rounded-md", colorClass)}>
      {icon}
    </div>
    <span className="text-muted-foreground">{label}</span>
  </div>
);
