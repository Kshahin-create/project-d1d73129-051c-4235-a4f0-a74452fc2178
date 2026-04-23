import { motion, AnimatePresence } from "framer-motion";
import { Lock, CheckCircle2, ZoomIn, X } from "lucide-react";
import { useState } from "react";
import type { Unit } from "@/data/types";
import { cn } from "@/lib/utils";

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

  return (
    <div className="space-y-6">
      {/* Plan image */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {planImage ? (
          <>
            <img
              src={planImage}
              alt={`مخطط مبنى ${buildingNumber}`}
              className="h-full max-h-[420px] w-full cursor-zoom-in object-contain bg-secondary"
              onClick={() => setZoomed(true)}
            />
            <button
              onClick={() => setZoomed(true)}
              className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-primary/90 px-3 py-1.5 text-xs font-medium text-primary-foreground backdrop-blur-sm"
            >
              <ZoomIn className="h-3.5 w-3.5" /> تكبير المخطط
            </button>
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
        <LegendDot colorClass="bg-primary" label="مختار" />
        <LegendDot colorClass="bg-muted border border-border opacity-60" label="مؤجر" icon={<Lock className="h-3 w-3" />} />
      </div>

      {/* Units grid */}
      <div>
        <h4 className="mb-3 font-display font-bold">اختر رقم الوحدة</h4>
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
              className="absolute left-4 top-4 rounded-full bg-background/10 p-2 text-primary-foreground hover:bg-background/20"
            >
              <X className="h-5 w-5" />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              src={planImage}
              alt={`مخطط مبنى ${buildingNumber}`}
              className="max-h-full max-w-full rounded-xl object-contain shadow-elevated"
            />
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
