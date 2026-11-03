import { motion } from "framer-motion";
import { CheckCircle2, ArrowLeft, ArrowRight, Wrench, Cog, Droplets, UtensilsCrossed, Hammer, Flame, Warehouse, Package, MapPin, type LucideIcon } from "lucide-react";
import serviceMap from "@/assets/activity-map-service.png";
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

const ACTIVITY_ICONS: Record<BookingActivity, LucideIcon> = {
  service: Wrench, parts: Cog, tires: Droplets, food: UtensilsCrossed,
  carpentry: Hammer, smithing: Flame, "warehouse-a": Warehouse, "warehouse-b": Package,
};

export const BuildingSelector = ({ buildings, units, onSelect, selected, activityFilter }: BuildingSelectorProps) => {
  if (!activityFilter) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BOOKING_ACTIVITIES.map((activity, idx) => {
          const scoped = buildings.filter((b) => buildingInActivity(b, activity.key));
          const available = scoped.reduce((s, b) => s + b.availableUnits, 0);
          const total = scoped.reduce((s, b) => s + b.totalUnits, 0);
          const Icon = ACTIVITY_ICONS[activity.key];
          const ready = scoped.length > 0;
          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-foreground transition group-hover:scale-105">
                  <Icon className="h-7 w-7" />
                </div>
                <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", ready ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                  {ready ? <><span className="num">{available}</span> وحدة متاحة</> : "قريبًا"}
                </span>
              </div>
              <h3 className="mt-5 font-display text-xl font-bold text-foreground">{activity.title}</h3>
              <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">{activity.description}</p>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted-foreground">{ready ? <><span className="num">{scoped.length}</span> مبانٍ · <span className="num">{total}</span> وحدة</> : "الوحدات تُطرح قريبًا"}</span>
                {ready && <span className="inline-flex items-center gap-1 font-semibold text-primary">تصفّح<ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" /></span>}
              </div>
            </>
          );
          const cls = "group flex h-full flex-col rounded-2xl border-2 bg-card p-6 text-right shadow-card transition-all";
          return (
            <motion.div key={activity.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: idx * 0.04 }}>
              {ready
                ? <Link to={`/booking?activity=${activity.key}`} className={cn(cls, "border-border hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg")}>{body}</Link>
                : <div aria-disabled className={cn(cls, "border-dashed border-border opacity-80")}>{body}</div>}
            </motion.div>
          );
        })}
      </div>
    );
  }
  const activity = BOOKING_ACTIVITIES.find((a) => a.key === activityFilter)!;
  const scoped = buildings.filter((b) => buildingInActivity(b, activity.key));
  const Icon = ACTIVITY_ICONS[activity.key];
  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" className="rounded-full" asChild><Link to="/booking"><ArrowRight className="h-4 w-4" /> كل الأنشطة</Link></Button>
      {scoped.length
        ? <Section title={activity.title} subtitle={`${scoped.length} مبانٍ · ${activity.description}`} icon={<Icon className="h-5 w-5" />} buildings={scoped} units={units} onSelect={onSelect} selected={selected} />
        : <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><h3 className="font-display text-lg font-bold">{activity.title}</h3><p className="mt-2 text-sm text-muted-foreground">{activity.description}</p><p className="mt-3 text-sm font-semibold text-primary">الوحدات تُطرح قريبًا</p></section>}
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
            "group relative h-auto w-full flex-col items-stretch whitespace-normal overflow-hidden rounded-lg border-2 bg-card p-4 text-right text-foreground shadow-card transition-all hover:bg-card hover:text-foreground hover:shadow-lg",
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
