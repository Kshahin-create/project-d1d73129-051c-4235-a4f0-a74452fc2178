import { motion, AnimatePresence } from "framer-motion";
import { Lock, CheckCircle2, ZoomIn, X } from "lucide-react";
import { useState } from "react";
import type { Unit } from "@/data/types";
import { cn } from "@/lib/utils";
import { getPlanLayout } from "@/data/buildingPlans";

interface UnitGridProps {
  buildingNumber: number;
  units: Unit[];
  selectedUnit?: number;
  onSelect: (unit: Unit) => void;
  /** Optional building plan image. Add PNGs to src/assets/plans/ as building-{n}.png */
  planImage?: string;
}

export const UnitGrid = ({ buildingNumber, units, selectedUnit, onSelect, planImage }: UnitGridProps) => {
  const [zoomed, setZoomed] = useState(false);
  const [hoveredUnit, setHoveredUnit] = useState<number | null>(null);
  const layout = getPlanLayout(buildingNumber);
  const unitsByNumber = new Map(units.map((u) => [u.unitNumber, u]));

  const renderOverlay = (interactive: boolean) =>
    layout?.units.map((area) => {
      const unit = unitsByNumber.get(area.unitNumber);
      if (!unit) return null;
      const isRented = unit.status === "rented";
      const isSelected = selectedUnit === unit.unitNumber;
      const isHovered = hoveredUnit === unit.unitNumber;

      return (
        <button
          key={area.unitNumber}
          type="button"
          disabled={isRented || !interactive}
          onClick={() => interactive && onSelect(unit)}
          onMouseEnter={() => interactive && setHoveredUnit(unit.unitNumber)}
          onMouseLeave={() => interactive && setHoveredUnit(null)}
          aria-label={`وحدة ${area.unitNumber}${isRented ? " (مؤجرة)" : ""}`}
          className={cn(
            "absolute flex items-center justify-center rounded-md border-2 text-[10px] font-bold transition-all duration-200 sm:text-xs",
            "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1",
            isRented && "cursor-not-allowed border-destructive/70 bg-destructive/40 text-destructive-foreground",
            !isRented && !isSelected &&
              "border-accent/0 bg-accent/0 text-transparent hover:border-accent hover:bg-accent/30 hover:text-accent-foreground",
            !isRented && isSelected &&
              "border-accent bg-accent/70 text-accent-foreground shadow-elevated ring-2 ring-accent",
            isHovered && !isSelected && !isRented && "scale-105 z-10"
          )}
          style={{
            left: `${area.x}%`,
            top: `${area.y}%`,
            width: `${area.w}%`,
            height: `${area.h}%`,
          }}
        >
          <span className="num drop-shadow-sm">{area.unitNumber}</span>
        </button>
      );
    });

  return (
    <div className="space-y-6">
      {/* Plan image with interactive overlay */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {planImage ? (
          <>
            <div className="relative w-full">
              <img
                src={planImage}
                alt={`مخطط مبنى ${buildingNumber}`}
                className="block h-auto max-h-[520px] w-full object-contain bg-secondary"
              />
              {/* Interactive unit overlay */}
              {layout && (
                <div className="absolute inset-0" aria-hidden={false}>
                  {renderOverlay(true)}
                </div>
              )}
            </div>

            <button
              onClick={() => setZoomed(true)}
              className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-primary/90 px-3 py-1.5 text-xs font-medium text-primary-foreground backdrop-blur-sm hover:bg-primary"
            >
              <ZoomIn className="h-3.5 w-3.5" /> تكبير المخطط
            </button>

            {/* Hint */}
            {layout && (
              <div className="absolute right-3 top-3 z-20 rounded-full bg-card/90 px-3 py-1.5 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm sm:text-xs">
                اضغط على الوحدة في المخطط لاختيارها
              </div>
            )}
          </>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center gap-2 bg-secondary text-muted-foreground">
            <p className="text-sm">
              مخطط المبنى <span className="num font-bold">{buildingNumber}</span> سيُعرض هنا
            </p>
            <p className="text-xs">
              ارفع الصورة إلى <code className="rounded bg-background px-1.5 py-0.5 text-[10px]">src/assets/plans/building-{buildingNumber}.png</code>
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
        <LegendDot colorClass="bg-card border-2 border-border" label="متاح" />
        <LegendDot colorClass="bg-accent border-2 border-accent" label="مختار" />
        <LegendDot colorClass="bg-destructive/40 border-2 border-destructive/70" label="مؤجر" icon={<Lock className="h-3 w-3" />} />
      </div>

      {/* Units grid (alternative quick selection) */}
      <div>
        <h4 className="mb-3 font-display font-bold">أو اختر رقم الوحدة من القائمة</h4>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {units.map((u) => {
            const isRented = u.status === "rented";
            const isSelected = selectedUnit === u.unitNumber;
            const isCorner = u.unitType === "ركنية";
            return (
              <motion.button
                key={u.unitNumber}
                whileHover={!isRented ? { scale: 1.05 } : undefined}
                whileTap={!isRented ? { scale: 0.96 } : undefined}
                disabled={isRented}
                onClick={() => onSelect(u)}
                className={cn(
                  "group relative flex aspect-square flex-col items-center justify-center rounded-xl border-2 p-1 text-center transition-all",
                  isRented &&
                    "cursor-not-allowed border-border bg-muted opacity-70",
                  !isRented && !isSelected &&
                    "border-border bg-card hover:border-primary hover:shadow-card",
                  isSelected &&
                    "border-primary bg-primary text-primary-foreground shadow-elevated"
                )}
              >
                {isCorner && !isRented && (
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
                    <Lock className="h-2.5 w-2.5" /> مؤجر
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
            <button
              onClick={() => setZoomed(false)}
              className="absolute left-4 top-4 z-10 rounded-full bg-background/10 p-2 text-primary-foreground hover:bg-background/20"
            >
              <X className="h-5 w-5" />
            </button>
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-full max-w-full"
            >
              <img
                src={planImage}
                alt={`مخطط مبنى ${buildingNumber}`}
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
