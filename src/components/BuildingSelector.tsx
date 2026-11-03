import { motion } from "framer-motion";
import { Building2, CheckCircle2, ArrowLeft } from "lucide-react";
import type { Building, Unit } from "@/data/types";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BOOKING_ACTIVITIES, buildingInActivity, classifyBookingActivity, type BookingActivity } from "@/lib/bookingActivities";

interface BuildingSelectorProps {
  buildings: Building[];
  units: Unit[];
  onSelect: (b: Building) => void;
  selected?: number;
  activityFilter?: BookingActivity | null;
}

export const BuildingSelector = ({ buildings, units, onSelect, selected, activityFilter }: BuildingSelectorProps) => {
  const groups = BOOKING_ACTIVITIES.filter((activity) => !activityFilter || activity.key === activityFilter);
  const shown = new Set<number>();
  return (
    <div className="space-y-8">
      <nav aria-label="الأنشطة" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        <Button size="sm" className="shrink-0 rounded-full" variant={!activityFilter ? "default" : "outline"} asChild><Link to="/booking">كل الأنشطة</Link></Button>
        {BOOKING_ACTIVITIES.map((activity) => <Button key={activity.key} size="sm" className="shrink-0 rounded-full" variant={activityFilter === activity.key ? "default" : "outline"} asChild><Link to={`/booking?activity=${activity.key}`}>{activity.short}{buildings.some((b) => buildingInActivity(b, activity.key)) ? "" : " · قريبًا"}</Link></Button>)}
      </nav>
      {groups.map((activity) => {
        // In "all" view, list each building once under its first activity.
        const scoped = buildings.filter((building) => buildingInActivity(building, activity.key) && (activityFilter || !shown.has(building.number)));
        scoped.forEach((b) => shown.add(b.number));
        if (!scoped.length) return activityFilter ? <section key={activity.key} className="rounded-lg border border-border bg-card p-6 text-center"><h3 className="font-display text-lg font-bold">{activity.title}</h3><p className="mt-2 text-sm text-muted-foreground">{activity.description}</p><p className="mt-3 text-sm font-semibold text-primary">قريبًا — الوحدات لم تُطرح للحجز بعد</p></section> : null;
        return <Section key={activity.key} title={activity.title} subtitle={`${scoped.length} مبانٍ · ${activity.description}`} icon={<Building2 className="h-5 w-5" />} buildings={scoped} units={units} onSelect={onSelect} selected={selected} />;
      })}
      {buildings.length === 0 && <p className="py-8 text-center text-muted-foreground">لا توجد مبانٍ متاحة للعرض حاليًا.</p>}
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
        <motion.div
          key={b.number}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: idx * 0.04 }}
          whileHover={{ y: -4 }}
        >
          <Button variant="outline" onClick={() => onSelect(b)}
          className={cn(
            "group relative h-auto w-full flex-col items-stretch whitespace-normal overflow-hidden rounded-lg border-2 bg-card p-4 text-right shadow-card transition-all",
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
                لا وحدات متاحة
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
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs font-semibold text-primary transition">
            اختر هذا المبنى
            <ArrowLeft className="h-4 w-4" />
          </div>
        </Button></motion.div>
      ))}
    </div>
  </section>
);
