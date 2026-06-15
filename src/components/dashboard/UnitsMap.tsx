import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Building, Unit } from "@/data/types";
import { UnitDetailsDialog } from "./UnitDetailsDialog";

type Props = {
  buildings: Building[];
  units: Unit[];
};

const STATUS_BG: Record<Unit["status"], string> = {
  rented:   "bg-primary text-primary-foreground border-primary hover:bg-primary/90",
  reserved: "bg-amber-500 text-white border-amber-500 hover:bg-amber-600",
  available:"bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600",
};
const STATUS_DOT: Record<Unit["status"], string> = {
  rented:   "bg-primary",
  reserved: "bg-amber-500",
  available:"bg-emerald-500",
};
const STATUS_LABEL: Record<Unit["status"], string> = {
  rented: "مؤجر", reserved: "محجوز", available: "متاح",
};

export function UnitsMap({ buildings, units }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Unit["status"]>("all");
  const [selected, setSelected] = useState<Unit | null>(null);
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const s = search.trim().toLowerCase();
    return buildings
      .slice()
      .sort((a, b) => a.number - b.number)
      .map((b) => {
        const us = units
          .filter((u) => u.buildingNumber === b.number)
          .filter((u) => statusFilter === "all" || u.status === statusFilter)
          .filter((u) => {
            if (!s) return true;
            return `${u.buildingNumber} ${u.unitNumber} ${u.activity ?? ""} ${u.unitType ?? ""}`
              .toLowerCase().includes(s);
          })
          .sort((a, b) => a.unitNumber - b.unitNumber);
        return { building: b, units: us };
      })
      .filter((g) => g.units.length > 0);
  }, [buildings, units, search, statusFilter]);

  const openUnit = (u: Unit) => { setSelected(u); setOpen(true); };

  return (
    <>
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-bold">
              <MapPin className="h-5 w-5 text-accent" /> خريطة الوحدات التفاعلية
            </h2>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Info className="h-3 w-3" /> اضغط على أي وحدة لعرض سجلها الكامل وتفاصيل الحجوزات
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="flex items-center gap-1"><span className={cn("h-3 w-3 rounded", STATUS_DOT.rented)} /> مؤجر</span>
            <span className="flex items-center gap-1"><span className={cn("h-3 w-3 rounded", STATUS_DOT.reserved)} /> محجوز</span>
            <span className="flex items-center gap-1"><span className={cn("h-3 w-3 rounded", STATUS_DOT.available)} /> متاح</span>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-5 grid gap-3 sm:grid-cols-[1fr,auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم المبنى أو الوحدة أو النشاط…"
              className="pr-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["all","available","reserved","rented"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-md border px-3 py-2 text-xs font-medium transition",
                  statusFilter === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-accent",
                )}
              >
                {s === "all" ? "الكل" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Buildings */}
        <div className="space-y-5">
          {groups.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/30 p-10 text-center text-sm text-muted-foreground">
              لا توجد نتائج مطابقة
            </div>
          ) : groups.map(({ building, units: us }) => {
            const rented = us.filter((u) => u.status === "rented").length;
            const reserved = us.filter((u) => u.status === "reserved").length;
            const available = us.filter((u) => u.status === "available").length;
            return (
              <div key={building.number} className="rounded-xl border bg-gradient-to-b from-muted/20 to-card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-display font-extrabold text-primary-foreground">
                      <span className="num">{building.number}</span>
                    </div>
                    <div>
                      <div className="font-display text-sm font-bold">مبنى رقم {building.number}</div>
                      <div className="text-[11px] text-muted-foreground">{building.type}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary"><span className="num ml-1">{rented}</span> مؤجر</Badge>
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800"><span className="num ml-1">{reserved}</span> محجوز</Badge>
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800"><span className="num ml-1">{available}</span> متاح</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
                  {us.map((u) => (
                    <button
                      key={`${u.buildingNumber}-${u.unitNumber}`}
                      onClick={() => openUnit(u)}
                      title={`وحدة ${u.unitNumber} · ${STATUS_LABEL[u.status]} · ${u.activity ?? ""}`}
                      className={cn(
                        "group relative flex aspect-square flex-col items-center justify-center rounded-lg border-2 text-center transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring",
                        STATUS_BG[u.status],
                      )}
                    >
                      <span className="num font-display text-base font-extrabold leading-none">{u.unitNumber}</span>
                      <span className="mt-0.5 text-[8px] opacity-80">{u.unitType?.[0] ?? ""}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <UnitDetailsDialog unit={selected} open={open} onOpenChange={setOpen} />
    </>
  );
}
