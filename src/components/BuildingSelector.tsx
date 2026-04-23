import { motion } from "framer-motion";
import { Wrench, Cog, CheckCircle2, ArrowLeft } from "lucide-react";
import type { Building, Unit } from "@/data/types";
import { cn } from "@/lib/utils";

interface BuildingSelectorProps {
  buildings: Building[];
  units: Unit[];
  onSelect: (b: Building) => void;
  selected?: number;
}

export const BuildingSelector = ({ buildings, units, onSelect, selected }: BuildingSelectorProps) => {
  const service = buildings.filter((b) => b.type.includes("صيانة"));
  const parts = buildings.filter((b) => !b.type.includes("صيانة"));

  return (
    <div className="space-y-10">
      <Section
        title="مراكز صيانة السيارات"
        subtitle="المباني من 1 إلى 6"
        icon={<Wrench className="h-5 w-5" />}
        buildings={service}
        units={units}
        onSelect={onSelect}
        selected={selected}
      />
      <Section
        title="محلات قطع الغيار والبناشر"
        subtitle="المباني من 7 إلى 10"
        icon={<Cog className="h-5 w-5" />}
        buildings={parts}
        units={units}
        onSelect={onSelect}
        selected={selected}
      />
    </div>
  );
};

interface SectionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  buildings: Building[];
  units: Unit[];
  onSelect: (b: Building) => void;
  selected?: number;
}

const Section = ({ title, subtitle, icon, buildings, onSelect, selected }: SectionProps) => (
  <section>
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent-foreground">
        {icon}
      </div>
      <div>
        <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {buildings.map((b, idx) => (
        <motion.button
          key={b.number}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: idx * 0.04 }}
          whileHover={{ y: -4 }}
          onClick={() => onSelect(b)}
          className={cn(
            "group relative overflow-hidden rounded-2xl border-2 bg-card p-4 text-right shadow-card transition-all",
            selected === b.number
              ? "border-primary ring-2 ring-primary/20"
              : "border-border hover:border-primary/50"
          )}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground">مبنى</div>
              <div className="font-display text-3xl font-extrabold text-primary num">
                {b.number}
              </div>
            </div>
            {b.availableUnits > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                <CheckCircle2 className="h-3 w-3" /> متاح
              </span>
            ) : (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                مكتمل
              </span>
            )}
          </div>
          <div className="mt-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">إجمالي الوحدات</span>
              <span className="font-bold num">{b.totalUnits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">المتاح</span>
              <span className="font-bold text-success num">{b.availableUnits}</span>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">
            اختر هذا المبنى
            <ArrowLeft className="h-4 w-4" />
          </div>
        </motion.button>
      ))}
    </div>
  </section>
);
