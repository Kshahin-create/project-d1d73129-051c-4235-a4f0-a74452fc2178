import { ArrowLeft, MapPin } from "lucide-react";
import type { Unit } from "@/data/types";
import type { BuildingSection } from "@/data/buildingPlans";
import { getBuildingLocationImages } from "@/components/BuildingLocationPreview";
import { Button } from "@/components/ui/button";
import { bookingUnitState } from "@/lib/unitStatus";
import { unitAllowedForActivity, type BookingActivity } from "@/lib/bookingActivities";

interface Props {
  buildingNumber: number;
  sections: BuildingSection[];
  units: Unit[];
  selectedUnitNumbers: number[];
  activity?: BookingActivity | null;
  onPick: (sectionKey: string) => void;
}

/** Asks which part of a multi-section building the customer wants (أ / ب). */
export const BuildingSectionPicker = ({ buildingNumber, sections, units, selectedUnitNumbers, activity, onPick }: Props) => {
  const selected = new Set(selectedUnitNumbers);
  return (
    <div className="grid gap-4 sm:grid-cols-2" dir="rtl">
      {sections.map((s) => {
        const nums = new Set(s.unitNumbers);
        const sectionUnits = units.filter((u) => nums.has(u.unitNumber));
        const available = sectionUnits.filter(
          (u) => bookingUnitState(u.leasingStatus, unitAllowedForActivity(u, activity), u.legacyStatus).selectable,
        ).length;
        const picked = s.unitNumbers.filter((n) => selected.has(n)).length;
        const image = getBuildingLocationImages(buildingNumber, s.key)[0];
        const first = Math.min(...s.unitNumbers);
        const last = Math.max(...s.unitNumbers);
        return (
          <Button
            key={s.key}
            type="button"
            variant="outline"
            onClick={() => onPick(s.key)}
            aria-label={`اختيار ${s.label}`}
            className="group h-auto flex-col items-stretch gap-0 overflow-hidden whitespace-normal rounded-2xl border-2 p-0 text-right shadow-card transition hover:border-primary hover:shadow-elevated"
          >
            {image ? (
              <img
                src={image.url}
                alt={`موقع ${s.label} في المخطط العام`}
                width={1920}
                height={967}
                loading="lazy"
                className="block aspect-[1920/967] w-full border-b border-border bg-secondary object-contain"
              />
            ) : (
              <div className="flex aspect-[1920/967] w-full items-center justify-center border-b border-border bg-secondary text-sm text-muted-foreground">
                <MapPin className="ms-1 h-4 w-4" /> صورة الموقع غير متاحة حاليًا
              </div>
            )}
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="space-y-1">
                <div className="font-display text-xl font-extrabold text-foreground">{s.label}</div>
                <div className="text-xs text-muted-foreground">
                  الوحدات من <span className="num">{first}</span> إلى <span className="num">{last}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1 text-xs">
                  <span className="rounded-full bg-success/15 px-2 py-0.5 font-bold text-foreground">
                    متاح <span className="num">{available}</span> من <span className="num">{sectionUnits.length}</span>
                  </span>
                  {picked > 0 && (
                    <span className="rounded-full bg-primary px-2 py-0.5 font-bold text-primary-foreground">
                      اخترت <span className="num">{picked}</span>
                    </span>
                  )}
                </div>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition group-hover:-translate-x-1">
                <ArrowLeft className="h-5 w-5" />
              </span>
            </div>
          </Button>
        );
      })}
    </div>
  );
};
