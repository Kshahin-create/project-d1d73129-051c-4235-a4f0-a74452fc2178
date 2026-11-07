import { MapPin, ZoomIn } from "lucide-react";
import building1A from "@/assets/building-1-a-location.png.asset.json";
import building1B from "@/assets/building-1-b-location.webp.asset.json";
import building2A from "@/assets/building-2-a-location.webp.asset.json";
import building2B from "@/assets/building-2-b-location.webp.asset.json";
import building3A from "@/assets/building-3-a-location.webp.asset.json";
import building3B from "@/assets/building-3-b-location.webp.asset.json";
import building4A from "@/assets/building-4-a-location.webp.asset.json";
import building4B from "@/assets/building-4-b-location.webp.asset.json";
import building5A from "@/assets/building-5-a-location.webp.asset.json";
import building5B from "@/assets/building-5-b-location.webp.asset.json";
import building6B from "@/assets/building-6-b-location.webp.asset.json";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type LocationImage = { url: string; label: string };

// Only register explicitly supplied section images; never borrow another section's map.
const locationImages: Record<string, LocationImage> = {
  "1-a": { url: building1A.url, label: "مبنى ١ — أ" },
  "1-b": { url: building1B.url, label: "مبنى ١ — ب" },
  "2-a": { url: building2A.url, label: "مبنى ٢ — أ" },
  "2-b": { url: building2B.url, label: "مبنى ٢ — ب" },
  "3-a": { url: building3A.url, label: "مبنى ٣ — أ" },
  "3-b": { url: building3B.url, label: "مبنى ٣ — ب" },
  "4-a": { url: building4A.url, label: "مبنى ٤ — أ" },
  "4-b": { url: building4B.url, label: "مبنى ٤ — ب" },
  "5-a": { url: building5A.url, label: "مبنى ٥ — أ" },
  "5-b": { url: building5B.url, label: "مبنى ٥ — ب" },
  "6-b": { url: building6B.url, label: "مبنى ٦ — ب" },
};

const SECTION_ORDER = ["a", "b"];

/** Returns the supplied location images for a building (one section, or all sections in order). */
export function getBuildingLocationImages(buildingNumber: number, section?: string): LocationImage[] {
  const sections = section ? [section] : SECTION_ORDER;
  return sections.map((s) => locationImages[`${buildingNumber}-${s}`]).filter(Boolean);
}

export function BuildingLocationPreview({ buildingNumber, section }: { buildingNumber: number; section?: string }) {
  const images = getBuildingLocationImages(buildingNumber, section);
  if (images.length === 0) return null;
  const compact = images.length > 1;

  return (
    <div className="flex flex-wrap justify-start gap-2" dir="rtl">
      {images.map((image) => (
        <Dialog key={image.label}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              aria-label={`تكبير موقع ${image.label} في المشروع`}
              className={
                compact
                  ? "h-auto w-40 max-w-[calc(50vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-lg p-0 shadow-sm sm:w-48"
                  : "h-auto w-56 max-w-full flex-col gap-0 overflow-hidden rounded-lg p-0 shadow-sm sm:w-64"
              }
            >
              <span className="flex w-full items-center justify-between gap-2 border-b border-border bg-muted/40 px-2.5 py-1.5 text-xs">
                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" />موقع {image.label}</span>
                <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <img src={image.url} alt={`موقع ${image.label} في المخطط العام`} width={1920} height={967} loading="lazy" className="block aspect-[1920/967] w-full object-contain" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl" dir="rtl" aria-describedby={undefined}>
            <DialogTitle className="pe-6">موقع {image.label} في المشروع</DialogTitle>
            <img src={image.url} alt={`موقع ${image.label} في المخطط العام`} width={1920} height={967} className="max-h-[75vh] w-full object-contain" />
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
