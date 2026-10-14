import type { BookingRow, BookingUnitRow, CollectionRow, DashboardUnit, InvoiceRow } from './dashboardMetrics';

export type ReviewRow = { category: string; reference: string; note: string; unitId?: string };
// Review flags indicate missing/inconsistent evidence, not inferred payment eligibility.
export function dashboardReview(units: DashboardUnit[], bookings: BookingRow[], links: BookingUnitRow[], invoices: InvoiceRow[], collections: CollectionRow[]): ReviewRow[] {
  const rows: ReviewRow[] = [];
  const byId = new Map(units.map(u => [u.id, u]));
  const pending = new Set(bookings.filter(b => b.status === 'pending').map(b => b.id));
  const flagged = new Set<string>();
  for (const link of links) {
    const u = byId.get(link.unit_id);
    if (!u || !pending.has(link.booking_id) || !['available', 'maintenance'].includes(u.status) || flagged.has(u.id)) continue;
    flagged.add(u.id);
    rows.push({ category: 'حالة وحدة مرتبطة بطلب معلق', reference: `مبنى ${u.building_number} · وحدة ${u.unit_number}`, note: 'طلب معلق مرتبط بوحدة غير محجوزة أو مؤجرة؛ يحتاج مراجعة دون تعديل تلقائي.', unitId: u.id });
  }
  for (const u of units) {
    if (!['rented','reserved','available','booked','maintenance'].includes(u.status)) rows.push({ category: 'حالة وحدة غير محددة', reference: `مبنى ${u.building_number} · وحدة ${u.unit_number}`, note: 'تُحسب منفصلة ولا تُصنف متاحة.', unitId: u.id });
    if (!u.activity?.trim()) rows.push({ category: 'نشاط وحدة غير مسجل', reference: `مبنى ${u.building_number} · وحدة ${u.unit_number}`, note: 'لا تدخل ضمن الأنشطة الثلاثة المصنفة.', unitId: u.id });
  }
  for (const i of new Map(invoices.map(i => [i.id,i])).values()) {
    if (!i.paid && Number(i.amount) > Number(i.paid_amount) && (!i.due_date || !/^\d{4}-\d{2}-\d{2}$/.test(i.due_date) || !Number.isFinite(Date.parse(i.due_date)))) rows.push({ category: 'رصيد فاتورة بلا موعد صالح', reference: i.invoice_number ?? 'فاتورة بلا رقم', note: 'لا تدخل في المستحق أو المتأخر لغياب موعد موثق.' });
  }
  for (const c of collections) {
    if (!c.is_archived && byId.has(c.unit_id) && !Number.isFinite(Date.parse(c.created_at))) rows.push({ category: 'تحصيل بلا تاريخ صالح', reference: 'دفعة مسجلة', note: 'لا يمكن إسنادها لفترة تقرير.' });
  }
  return rows;
}