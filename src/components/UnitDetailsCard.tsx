import { motion } from "framer-motion";
import { Building, Hash, Maximize2, Wallet, Tag } from "lucide-react";
import type { Unit } from "@/data/types";

export const UnitDetailsCard = ({ unit }: { unit: Unit }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
    >
      <div className="bg-gradient-primary p-6 text-primary-foreground">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs opacity-80">الوحدة المختارة</div>
            <div className="mt-1 font-display text-4xl font-extrabold num">
              #{unit.unitNumber}
            </div>
          </div>
          {unit.unitType && (
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground shadow-gold">
              {unit.unitType}
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        <Row icon={<Building className="h-4 w-4" />} label="المبنى">
          رقم <span className="num font-bold">{unit.buildingNumber}</span> — {unit.buildingType}
        </Row>
        <Row icon={<Tag className="h-4 w-4" />} label="النشاط">
          {unit.activity ?? unit.buildingType}
        </Row>
        <Row icon={<Maximize2 className="h-4 w-4" />} label="المساحة">
          <span className="num font-bold">{unit.area}</span> م²
        </Row>
        <Row icon={<Wallet className="h-4 w-4" />} label="الإيجار السنوي" highlight>
          <span className="num font-extrabold text-accent">
            {unit.price.toLocaleString("en-US")}
          </span>{" "}
          <span className="text-sm font-medium text-muted-foreground">ريال / سنوياً</span>
        </Row>
        <Row icon={<Hash className="h-4 w-4" />} label="سعر المتر">
          <span className="num font-bold">
            {unit.area > 0 ? Math.round(unit.price / unit.area).toLocaleString("en-US") : "-"}
          </span>{" "}
          <span className="text-xs text-muted-foreground">ريال/م²</span>
        </Row>
        <div className="flex items-center gap-2 bg-destructive/5 px-6 py-2.5 text-[11px] text-muted-foreground">
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-bold text-destructive">ملاحظة</span>
          قيمة الإيجار السنوي غير شاملة ضريبة القيمة المضافة ١٥٪؜
        </div>
      </div>
    </motion.div>
  );
};

const Row = ({
  icon,
  label,
  children,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) => (
  <div className={`flex items-center justify-between gap-4 px-6 py-3.5 ${highlight ? "bg-accent-soft/40" : ""}`}>
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
    <div className="text-sm text-foreground">{children}</div>
  </div>
);
