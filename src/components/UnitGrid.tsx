import { motion, AnimatePresence } from "framer-motion";
import { Lock, CheckCircle2, ZoomIn, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { Unit } from "@/data/types";
import { cn } from "@/lib/utils";
import { getPlanLayout, getBuildingSections, type BuildingSection, type PlanLayout } from "@/data/buildingPlans";
import { Button } from "@/components/ui/button";
import { unitAllowedForActivity, type BookingActivity } from "@/lib/bookingActivities";
import { bookingUnitState } from "@/lib/unitStatus";

interface UnitGridProps {
  buildingNumber: number;
  units: Unit[];
  /** Selected unit numbers (multi-select). */
  selectedUnits?: number[];
  onSelect: (unit: Unit) => void;
  /** Optional building plan image. Add PNGs to src/assets/plans/ as building-{n}.png */
  planImage?: string;
  activity?: BookingActivity | null;
}

const sectionImages = import.meta.glob("@/assets/plans/section-*.svg", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const sectionImage = (key: string) =>
  Object.entries(sectionImages).find(([k]) => k.endsWith(`section-${key}.svg`))?.[1];

export const UnitGrid = ({ section, ...props }: UnitGridProps & { section?: string | null }) => {
  const sections = getBuildingSections(props.buildingNumber, props.units.map((u) => u.unitNumber));
  if (sections.length <= 1 && !sections[0]?.planKey) return <UnitGridSection {...props} />;
  const renderSection = (s: BuildingSection) => {
    const nums = new Set(s.unitNumbers);
    return (
      <UnitGridSection
        {...props}
        units={props.units.filter((u) => nums.has(u.unitNumber))}
        planImage={s.planKey ? sectionImage(s.planKey) : props.planImage}
        layoutOverride={s.layout}
        planLabel={s.label}
      />
    );
  };
  // A chosen section shows only that section's plan and units.
  const chosen = section ? sections.find((s) => s.key === section) : undefined;
  if (chosen) return renderSection(chosen);
  return (
    <div className="space-y-10">
      {sections.map((s) => (
        <section key={s.key} className="space-y-3">
          <h3 className="font-display text-lg font-bold">{s.label}</h3>
          {renderSection(s)}
        </section>
      ))}
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
  activity,
}: UnitGridProps & { layoutOverride?: PlanLayout; planLabel?: string }) => {
  const [zoomed, setZoomed] = useState(false);
  const [hoveredUnit, setHoveredUnit] = useState<number | null>(null);
  const layout = layoutOverride ?? getPlanLayout(buildingNumber);
  const unitsByNumber = new Map(units.map((u) => [u.unitNumber, u]));
  const selectedSet = new Set(selectedUnits);
  const displayLabel = planLabel ?? `مبنى ${buildingNumber}${buildingNumber === 15 ? " - ب" : ""}`;

  const renderOverlay = (interactive: boolean) =>
    layout?.units.map((area) => {
      const unit = unitsByNumber.get(area.unitNumber);
      if (!unit) return null;
      const display = bookingUnitState(unit.leasingStatus, unitAllowedForActivity(unit, activity), unit.legacyStatus);
      const isRented = display.kind === "leased";
      const isReserved = display.kind === "reserved";
      const isLocked = !display.selectable;
      const isSelected = selectedSet.has(unit.unitNumber);
      const isHovered = hoveredUnit === unit.unitNumber;

      return (
        <Button
          key={area.unitNumber}
          type="button"
          disabled={isLocked || !interactive}
          onClick={() => interactive && onSelect(unit)}
          onMouseEnter={() => interactive && setHoveredUnit(unit.unitNumber)}
          onMouseLeave={() => interactive && setHoveredUnit(null)}
          aria-label={`وحدة ${area.unitNumber} (${display.label})`}
          aria-pressed={isSelected}
          title={display.label}
          className={cn(
            "absolute box-border flex min-h-0 items-center justify-center rounded-none border p-0 text-[10px] font-bold transition-colors duration-200 disabled:opacity-100 sm:text-xs [&_svg]:size-3",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-accent",
            isRented && "cursor-not-allowed border-background bg-destructive/95 text-primary-foreground",
            isReserved && "cursor-not-allowed border-background bg-accent/95 text-accent-foreground",
            display.kind === "unavailable" && "cursor-not-allowed border-background bg-muted-foreground/90 text-background",
            !isLocked && !isSelected &&
              "border-2 border-success bg-background/55 text-foreground hover:bg-success/40",
            !isLocked && isSelected && "border-primary-foreground bg-primary/95 text-primary-foreground",
            isHovered && !isSelected && !isLocked && "z-10"
          )}
          style={{
            left: `${area.x}%`,
            top: `${area.y}%`,
            width: `${area.w}%`,
            height: `${area.h}%`,
            backgroundImage: isLocked
              ? "repeating-linear-gradient(45deg, hsl(var(--background) / 0.28) 0 3px, transparent 3px 9px)"
              : undefined,
          }}
        >
          <span className="num flex flex-col items-center leading-none drop-shadow-sm">
            {isLocked && <Lock className="mb-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3" />}
            {area.unitNumber}
          </span>
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
        <LegendDot colorClass="bg-success/15 border-2 border-success" label="متاح" />
        <LegendDot colorClass="bg-primary border-2 border-primary" label="مختار" />
        <LegendDot colorClass="bg-accent border-2 border-accent text-accent-foreground" label="محجوز" icon={<Lock className="h-3 w-3" />} />
        <LegendDot colorClass="bg-destructive border-2 border-destructive text-primary-foreground" label="مؤجر" icon={<Lock className="h-3 w-3" />} />
        {units.some(u => bookingUnitState(u.leasingStatus, true, u.legacyStatus).kind === "unavailable") && <LegendDot colorClass="bg-muted-foreground border-2 border-muted-foreground text-background" label="غير متاح" icon={<Lock className="h-3 w-3" />} />}
      </div>

      {/* Units grid (alternative quick selection) */}
      <div>
        <h4 className="mb-3 font-display font-bold">أو اختر رقم الوحدة من القائمة</h4>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {units.map((u) => {
            const display = bookingUnitState(u.leasingStatus, unitAllowedForActivity(u, activity), u.legacyStatus);
            const isRented = display.kind === "leased";
            const isReserved = display.kind === "reserved";
            const isLocked = !display.selectable;
            const isSelected = selectedSet.has(u.unitNumber);
            const isCorner = u.unitType === "ركنية";
            return (
              <Button
                key={u.unitNumber}
                type="button"
                disabled={isLocked}
                title={display.label}
                aria-label={`وحدة ${u.unitNumber} (${display.label}) من القائمة`}
                aria-pressed={isSelected}
                onClick={() => display.selectable && onSelect(u)}
                className={cn(
                  "group relative flex h-auto w-full aspect-square flex-col items-center justify-center gap-0 whitespace-normal rounded-lg border-2 p-1 text-center transition-all disabled:opacity-100",
                  isRented &&
                    "cursor-not-allowed border-destructive bg-destructive/10 text-foreground",
                  isReserved &&
                    "cursor-not-allowed border-accent bg-accent/15 text-foreground",
                  display.kind === "unavailable" && "cursor-not-allowed border-muted-foreground/60 bg-muted text-muted-foreground",
                  !isLocked && !isSelected &&
                    "border-success/60 bg-success/10 hover:border-success hover:shadow-card",
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
                    <Lock className="h-2.5 w-2.5" /> {display.label}
                  </div>
                ) : isReserved ? (
                  <div className="mt-1 flex items-center gap-0.5 text-[9px] font-bold text-foreground">
                    <Lock className="h-2.5 w-2.5" /> {display.label}
                  </div>
                ) : isLocked ? (
                  <div className="mt-1 flex items-center gap-0.5 text-[9px] font-bold text-secondary-foreground"><Lock className="h-2.5 w-2.5" /> {display.label}</div>
                ) : isSelected ? (
                  <CheckCircle2 className="mt-1 h-3.5 w-3.5 text-primary-foreground" />
                ) : <span className="mt-1 text-[9px] font-bold text-primary">متاحة</span>}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      {createPortal(<AnimatePresence>
        {zoomed && planImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomed(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`مخطط ${displayLabel} مكبّر`}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/95 p-4 backdrop-blur-sm"
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
                className="block max-h-[90vh] max-w-[calc(100vw-2rem)] rounded-xl object-contain shadow-elevated"
              />
              {layout && (
                <div className="absolute inset-0">
                  {renderOverlay(true)}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
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
