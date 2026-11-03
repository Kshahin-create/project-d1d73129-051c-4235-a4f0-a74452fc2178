import { MapPin, ZoomIn } from "lucide-react";
import building1A from "@/assets/building-1-a-location.png.asset.json";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Only register explicitly supplied section images; never borrow another section's map.
const locationImages: Record<string, { url: string; label: string }> = {
  "1-a": { url: building1A.url, label: "مبنى ١ — أ" },
};

export function BuildingLocationPreview({ buildingNumber, section }: { buildingNumber: number; section: string }) {
  const image = locationImages[`${buildingNumber}-${section}`];
  if (!image) return null;

  return (
    <div className="flex justify-end" dir="rtl">
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            aria-label={`تكبير موقع ${image.label} في المشروع`}
            className="h-auto w-56 max-w-full flex-col gap-0 overflow-hidden rounded-lg p-0 shadow-sm sm:w-64"
          >
            <span className="flex w-full items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs">
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" />موقع {image.label}</span>
              <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
            <img src={image.url} alt={`موقع ${image.label} في المخطط العام`} width={1525} height={768} className="block aspect-[1525/768] w-full object-contain" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-5xl" dir="rtl" aria-describedby={undefined}>
          <DialogTitle className="pe-6">موقع {image.label} في المشروع</DialogTitle>
          <img src={image.url} alt={`موقع ${image.label} في المخطط العام`} width={1525} height={768} className="max-h-[75vh] w-full object-contain" />
        </DialogContent>
      </Dialog>
    </div>
  );
}