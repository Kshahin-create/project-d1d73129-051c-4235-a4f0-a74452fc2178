export interface Unit {
  buildingNumber: number;
  buildingType: string;
  unitNumber: number;
  unitType: string | null; // ركنية / داخلية
  area: number;
  activity: string | null;
  price: number;
  status: "available" | "rented" | "reserved";
  tenant: string | null;
}

export interface Building {
  number: number;
  type: string;
  totalUnits: number;
  rentedUnits: number;
  availableUnits: number;
  expectedAnnualRevenue: number;
}
