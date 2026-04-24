import * as XLSX from "xlsx";
import type { Unit } from "@/data/types";
import { PROJECT, COMPANY } from "@/lib/config";

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

const escapeHtml = (s: string | number | null | undefined) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export interface PDFExportMeta {
  buildingFilter?: number | null;
  statusFilter?: "all" | "rented" | "available";
  search?: string;
}

export const exportUnitsToPDF = (units: Unit[], meta: PDFExportMeta = {}) => {
  const rows = buildRows(units);
  const dateStr = new Date().toLocaleString("ar-EG", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const totalRented = units.filter((u) => u.status === "rented").length;
  const totalAvailable = units.length - totalRented;
  const totalRevenue = units
    .filter((u) => u.status === "rented")
    .reduce((s, u) => s + u.price, 0);

  const filterChips: string[] = [];
  filterChips.push(meta.buildingFilter ? `مبنى رقم ${meta.buildingFilter}` : "كل المباني");
  if (meta.statusFilter === "rented") filterChips.push("الحالة: مؤجر");
  else if (meta.statusFilter === "available") filterChips.push("الحالة: غير مؤجر");
  else filterChips.push("الحالة: الكل");
  if (meta.search?.trim()) filterChips.push(`بحث: "${meta.search.trim()}"`);

  const headers = [
    "المبنى", "الوحدة", "النوع", "النشاط",
    "المساحة (م²)", "السعر (سنوي)", "الحالة", "المستأجر",
  ];

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>تقرير الوحدات - ${escapeHtml(PROJECT.nameAr)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "Tahoma", "Arial", sans-serif;
    color: #0f172a;
    margin: 0;
    padding: 16px;
    direction: rtl;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid hsl(38, 78%, 52%);
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .title { font-size: 20px; font-weight: 800; margin: 0 0 4px; }
  .subtitle { font-size: 13px; color: #475569; margin: 0; }
  .meta { font-size: 11px; color: #64748b; text-align: left; }
  .meta div { margin-bottom: 2px; }
  .filters { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .chip {
    background: #f1f5f9; color: #0f172a;
    border-radius: 999px; padding: 3px 10px;
    font-size: 11px; font-weight: 600;
    border: 1px solid #e2e8f0;
  }
  .stats {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 8px; margin-bottom: 14px;
  }
  .stat { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; background: #f8fafc; }
  .stat .label { font-size: 10px; color: #64748b; }
  .stat .value { font-size: 16px; font-weight: 800; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead { background: hsl(195, 70%, 18%); color: hsl(40, 50%, 96%); }
  th, td { border: 1px solid hsl(195, 20%, 88%); padding: 6px 8px; text-align: right; }
  tbody tr:nth-child(even) { background: hsl(195, 25%, 97%); }
  /* Status badges — match /admin table colors exactly */
  .status-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 10px; border-radius: 999px;
    font-size: 10px; font-weight: 700;
    line-height: 1.4;
  }
  .status-badge::before {
    content: ""; display: inline-block;
    width: 6px; height: 6px; border-radius: 999px;
    background: currentColor;
  }
  .status-rented {
    color: hsl(0, 72%, 48%);
    background: hsl(0, 72%, 48%, 0.1);
  }
  .status-available {
    color: hsl(152, 60%, 36%);
    background: hsl(152, 60%, 36%, 0.1);
  }
  .footer {
    margin-top: 18px; padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    font-size: 10px; color: #64748b;
    display: flex; justify-content: space-between;
  }
  @media print {
    body { padding: 0; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">${escapeHtml(PROJECT.nameAr)}</h1>
      <p class="subtitle">${escapeHtml(COMPANY.name)} — تقرير الوحدات</p>
    </div>
    <div class="meta">
      <div><strong>تاريخ التصدير:</strong> ${escapeHtml(dateStr)}</div>
      <div><strong>عدد النتائج:</strong> ${units.length} وحدة</div>
    </div>
  </div>

  <div class="filters">
    ${filterChips.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join("")}
  </div>

  <div class="stats">
    <div class="stat"><div class="label">إجمالي الوحدات</div><div class="value">${units.length}</div></div>
    <div class="stat"><div class="label">مؤجرة</div><div class="value" style="color:#b91c1c">${totalRented}</div></div>
    <div class="stat"><div class="label">متاحة</div><div class="value" style="color:#047857">${totalAvailable}</div></div>
    <div class="stat"><div class="label">إيراد سنوي (مؤجر)</div><div class="value">${totalRevenue.toLocaleString("ar-EG")} ر.س</div></div>
  </div>

  <table>
    <thead>
      <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows.map((r) => `<tr>${headers.map((h) => {
        const v = (r as any)[h];
        if (h === "الحالة") {
          const cls = v === "مؤجر" ? "status-rented" : "status-available";
          return `<td class="${cls}">${escapeHtml(v)}</td>`;
        }
        if (h === "السعر (سنوي)" && typeof v === "number") {
          return `<td>${v.toLocaleString("ar-EG")}</td>`;
        }
        return `<td>${escapeHtml(v)}</td>`;
      }).join("")}</tr>`).join("")}
    </tbody>
  </table>

  <div class="footer">
    <span>${escapeHtml(PROJECT.owner)}</span>
    <span>تم الإنشاء بواسطة لوحة إدارة ${escapeHtml(COMPANY.name)}</span>
  </div>

  <script>
    window.addEventListener("load", () => {
      setTimeout(() => { window.print(); }, 300);
    });
  </script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=1200,height=800");
  if (!w) {
    alert("الرجاء السماح بالنوافذ المنبثقة لتصدير PDF");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
};
