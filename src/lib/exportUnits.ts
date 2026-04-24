import * as XLSX from "xlsx";
import type { Unit } from "@/data/types";

const buildRows = (units: Unit[]) =>
  units.map((u) => ({
    "المبنى": u.buildingNumber,
    "الوحدة": u.unitNumber,
    "النوع": u.unitType ?? "",
    "النشاط": u.activity ?? "",
    "المساحة (م²)": u.area,
    "السعر (سنوي)": u.price,
    "الحالة": u.status === "rented" ? "مؤجر" : "متاح",
    "المستأجر": u.tenant ?? "",
  }));

const fileStamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
};

export const exportUnitsToExcel = (units: Unit[]) => {
  const rows = buildRows(units);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "الوحدات");
  XLSX.writeFile(wb, `units_${fileStamp()}.xlsx`);
};

export const exportUnitsToCSV = (units: Unit[]) => {
  const rows = buildRows(units);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  // Add BOM for proper Arabic display in Excel
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `units_${fileStamp()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
