import * as XLSX from "xlsx";
import { PROJECT, COMPANY } from "@/lib/config";

interface AuditRow {
  id: string;
  building_number: number;
  unit_number: number;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  reason: string;
  performed_by_email: string | null;
  created_at: string;
}

const STATUS_AR: Record<string, string> = {
  available: "متاح",
  rented: "مؤجر",
  reserved: "محجوز",
};

const ACTION_AR: Record<string, string> = {
  rent: "تأجير",
  reserve: "حجز",
  release: "إخلاء",
  update: "تعديل",
};

const fileStamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
};

const buildRows = (entries: AuditRow[]) =>
  entries.map((e) => ({
    "التاريخ": new Date(e.created_at).toLocaleString("ar-EG-u-nu-latn"),
    "المبنى": e.building_number,
    "الوحدة": e.unit_number,
    "العملية": ACTION_AR[e.action] ?? e.action,
    "الحالة السابقة": e.previous_status ? STATUS_AR[e.previous_status] ?? e.previous_status : "—",
    "الحالة الجديدة": e.new_status ? STATUS_AR[e.new_status] ?? e.new_status : "—",
    "المنفّذ": e.performed_by_email ?? "—",
    "السبب": e.reason,
  }));

export const exportAuditToExcel = (entries: AuditRow[]) => {
  const ws = XLSX.utils.json_to_sheet(buildRows(entries));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "سجل التدقيق");
  XLSX.writeFile(wb, `audit_${fileStamp()}.xlsx`);
};

const escapeHtml = (s: string | number | null | undefined) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const exportAuditToPDF = (entries: AuditRow[], filterLabel?: string) => {
  const rows = buildRows(entries);
  const dateStr = new Date().toLocaleString("ar-EG", { dateStyle: "full", timeStyle: "short" });
  const headers = ["التاريخ", "المبنى", "الوحدة", "العملية", "الحالة السابقة", "الحالة الجديدة", "المنفّذ", "السبب"];

  const counts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.action] = (acc[e.action] ?? 0) + 1;
    return acc;
  }, {});

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>سجل التدقيق - ${escapeHtml(PROJECT.nameAr)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: "Segoe UI", "Tahoma", "Arial", sans-serif; color: hsl(195,45%,12%); margin:0; padding:16px; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid hsl(38,78%,52%); padding-bottom:12px; margin-bottom:16px; }
  .title { font-size:20px; font-weight:800; margin:0 0 4px; }
  .subtitle { font-size:13px; color:#475569; margin:0; }
  .meta { font-size:11px; color:#64748b; text-align:left; }
  .stats { display:grid; grid-template-columns: repeat(5,1fr); gap:8px; margin-bottom:14px; }
  .stat { border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; background:#f8fafc; }
  .stat .label { font-size:10px; color:#64748b; }
  .stat .value { font-size:16px; font-weight:800; margin-top:2px; }
  table { width:100%; border-collapse:collapse; font-size:10.5px; }
  thead { background: hsl(195,70%,18%); color: hsl(40,50%,96%); }
  th, td { border:1px solid hsl(195,20%,88%); padding:5px 7px; text-align:right; vertical-align:top; }
  tbody tr:nth-child(even) { background: hsl(195,25%,97%); }
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:10px; font-weight:700; background: hsl(195,70%,18%, 0.1); color: hsl(195,70%,18%); }
  .footer { margin-top:18px; padding-top:10px; border-top:1px solid #e2e8f0; font-size:10px; color:#64748b; display:flex; justify-content:space-between; }
  @media print { body { padding:0; } thead { display: table-header-group; } tr { page-break-inside: avoid; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">${escapeHtml(PROJECT.nameAr)}</h1>
      <p class="subtitle">${escapeHtml(COMPANY.name)} — سجل التدقيق</p>
      ${filterLabel ? `<p class="subtitle">الفلتر: ${escapeHtml(filterLabel)}</p>` : ""}
    </div>
    <div class="meta">
      <div><strong>تاريخ التصدير:</strong> ${escapeHtml(dateStr)}</div>
      <div><strong>عدد السجلات:</strong> ${entries.length}</div>
    </div>
  </div>

  <div class="stats">
    <div class="stat"><div class="label">إجمالي العمليات</div><div class="value">${entries.length}</div></div>
    <div class="stat"><div class="label">تأجير</div><div class="value">${counts.rent ?? 0}</div></div>
    <div class="stat"><div class="label">حجز</div><div class="value">${counts.reserve ?? 0}</div></div>
    <div class="stat"><div class="label">إخلاء</div><div class="value">${counts.release ?? 0}</div></div>
    <div class="stat"><div class="label">تعديل</div><div class="value">${counts.update ?? 0}</div></div>
  </div>

  <table>
    <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
    <tbody>
      ${rows.map((r) => `<tr>${headers.map((h) => {
        const v = (r as any)[h];
        if (h === "العملية") return `<td><span class="badge">${escapeHtml(v)}</span></td>`;
        return `<td>${escapeHtml(v)}</td>`;
      }).join("")}</tr>`).join("")}
    </tbody>
  </table>

  <div class="footer">
    <span>${escapeHtml(PROJECT.owner)}</span>
    <span>تم الإنشاء بواسطة لوحة إدارة ${escapeHtml(COMPANY.name)}</span>
  </div>

  <script>window.addEventListener("load",()=>{setTimeout(()=>window.print(),300);});</script>
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
