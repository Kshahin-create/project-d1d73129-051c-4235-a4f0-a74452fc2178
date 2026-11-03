import { CheckCircle2, ArrowLeft, ArrowRight, Wrench, Cog, Droplets, Store, Hammer, Flame, Warehouse, Package, MapPin, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import serviceMap from "@/assets/activity-map-service.png";
import smithingMap from "@/assets/activity-map-smithing.png.asset.json";
import carpentryMap from "@/assets/activity-map-carpentry.png.asset.json";
import partsMap from "@/assets/activity-map-parts.png.asset.json";
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
  service: Wrench, parts: Cog, tires: Droplets, shops: Store,
  carpentry: Hammer, smithing: Flame, "warehouse-a": Warehouse, "warehouse-b": Package,
};

// مخطط المشروع الكامل لكل نشاط، والمباني تبع النشاط معلّم عليها في الصورة نفسها
const ACTIVITY_MAPS: Partial<Record<BookingActivity, string>> = {
  service: serviceMap,
  smithing: smithingMap.url,
  // قطع الغيار والبناشر عليهم نفس المباني (7 إلى 10) فالمخطط واحد للاثنين
  parts: partsMap.url,
  tires: partsMap.url,
  carpentry: carpentryMap.url,
};

// مناطق الضغط على المخطط (نسب مئوية من أبعاد الصورة) لكل مبنى معلّم بالأخضر
interface MapHotspot { number: number; x: number; y: number; w: number; h: number }
const ACTIVITY_HOTSPOTS: Partial<Record<BookingActivity, MapHotspot[]>> = {
  service: [
    { number: 11, x: 3.5, y: 25.5, w: 21.7, h: 3.6 },
    { number: 1, x: 8.6, y: 31.8, w: 13.4, h: 3.7 },
    { number: 2, x: 8.6, y: 38.1, w: 13.3, h: 4.3 },
    { number: 3, x: 8.7, y: 44.2, w: 13.3, h: 3.7 },
    { number: 4, x: 8.6, y: 50.4, w: 13.4, h: 3.7 },
    { number: 5, x: 8.6, y: 57.2, w: 13.5, h: 3.8 },
    { number: 6, x: 8.4, y: 63.3, w: 13.7, h: 3.3 },
  ],
  smithing: [
    { number: 19, x: 29.9, y: 32.1, w: 13.4, h: 3.9 },
    { number: 18, x: 29.7, y: 38.3, w: 13.5, h: 4.0 },
    { number: 17, x: 29.8, y: 44.5, w: 13.4, h: 3.9 },
  ],
};

// مباني قطع الغيار والبناشر مشتركة، فمناطق الضغط واحدة للنشاطين
const partsHotspots: MapHotspot[] = [
  { number: 9, x: 3.3, y: 31.3, w: 1.7, h: 8.5 },
  { number: 10, x: 5.9, y: 31.3, w: 1.6, h: 8.5 },
  { number: 7, x: 3.1, y: 58.3, w: 1.8, h: 8.9 },
  { number: 8, x: 5.6, y: 58.3, w: 1.9, h: 8.9 },
];
ACTIVITY_HOTSPOTS.parts = partsHotspots;
ACTIVITY_HOTSPOTS.tires = partsHotspots;
// ورش النجارة: مباني 14 و15 و16 على المخطط
ACTIVITY_HOTSPOTS.carpentry = [
  { number: 16, x: 29.6, y: 50.4, w: 13.6, h: 4.2 },
  { number: 15, x: 29.6, y: 56.6, w: 13.5, h: 3.9 },
  { number: 14, x: 29.7, y: 62.6, w: 13.4, h: 4.1 },
];

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
  const activityMap = ACTIVITY_MAPS[activity.key];
  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" className="rounded-full" asChild><Link to="/booking"><ArrowRight className="h-4 w-4" /> كل الأنشطة</Link></Button>
      {activityMap && (
        <section className="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-card">
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-accent-soft px-5 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Icon className="h-5 w-5" /></div>
            <div>
              <h3 className="font-display text-base font-bold text-foreground">مخطط المشروع — {activity.title}</h3>
              <p className="text-xs text-muted-foreground">اضغط على أي مبنى معلّم على المخطط لاختياره</p>
            </div>
            <span className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success"><MapPin className="h-3.5 w-3.5" /> {scoped.length} مبانٍ</span>
          </div>
          <div className="relative">
            <img src={activityMap} alt={`مخطط المشروع الكامل مع تعليم مباني ${activity.title}`} className="w-full" loading="lazy" />
            {(ACTIVITY_HOTSPOTS[activity.key] ?? []).map((hs) => {
              const building = scoped.find((b) => b.number === hs.number);
              if (!building) return null;
              return (
                <button
                  key={hs.number}
                  type="button"
                  aria-label={`اختيار مبنى ${hs.number}`}
                  onClick={() => onSelect(building)}
                  style={{ left: `${hs.x}%`, top: `${hs.y}%`, width: `${hs.w}%`, height: `${hs.h}%` }}
                  className="group absolute cursor-pointer rounded-md border-2 border-primary/50 bg-primary/0 transition hover:border-primary hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground shadow-md">اختر مبنى <span className="num">{hs.number}</span></span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
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
