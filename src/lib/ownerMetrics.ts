import { aggregateUnits, inPeriod, number, type DashboardUnit, type BookingRow, type DateRange, type InvoiceRow } from './dashboardMetrics';

export type StatusEvent = { id: string; entity_table: string; entity_id: string; action: string; created_at: string; before_status: string | null; after_status: string | null };
// One canonical source: automatic audit records. Never union the duplicate manual action log.
export function statusTransitions(events: StatusEvent[], table: string, ids: Set<string>, range: DateRange, target?: string) {
  const seen = new Set<string>();
  return events.filter(e => {
    if (e.entity_table !== table || e.action !== 'UPDATE' || !ids.has(e.entity_id) || !e.before_status || !e.after_status || e.before_status === e.after_status || (target && e.after_status !== target) || !inPeriod(e.created_at, range)) return false;
    const key = `${e.entity_table}:${e.entity_id}:${e.created_at}:${e.before_status}:${e.after_status}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export function ownerProgress(units: DashboardUnit[], bookings: BookingRow[], events: StatusEvent[], range: DateRange) {
  const unitIds = new Set(units.map(u => u.id)), bookingIds = new Set(bookings.map(b => b.id));
  const rented = statusTransitions(events, 'units', unitIds, range, 'rented');
  return { requests: [...new Map(bookings.filter(b => inPeriod(b.created_at, range)).map(b => [b.id,b])).values()],
    rentedUnits: new Set(rented.map(e => e.entity_id)).size, rentedEvents: rented,
    cancellations: statusTransitions(events, 'bookings', bookingIds, range, 'cancelled'),
    expirations: statusTransitions(events, 'bookings', bookingIds, range, 'expired') };
}
export const ACTIVITY_GROUPS = [
  { key: 'مراكز صيانة سيارات', label: 'صيانة السيارات' },
  { key: 'قطع غيار سيارات', label: 'قطع الغيار' },
  { key: 'بنشر', label: 'خدمات الإطارات' },
];
export function activityPerformance(units: DashboardUnit[]) {
  const groups = ACTIVITY_GROUPS.map(g => ({ ...g, ...aggregateUnits(units.filter(u => u.activity?.trim() === g.key)) }));
  const unknown = units.filter(u => !ACTIVITY_GROUPS.some(g => g.key === u.activity?.trim()));
  return { groups, unknown };
}
export function invoiceObligations(rows: InvoiceRow[], today: string) {
  const unique = [...new Map(rows.map(i => [i.id,i])).values()];
  const dated = unique.filter(i => /^\d{4}-\d{2}-\d{2}$/.test(i.due_date ?? '') && Number.isFinite(new Date(`${i.due_date}T00:00:00Z`).getTime()) && !i.paid && number(i.amount) > number(i.paid_amount));
  const due = dated.filter(i => String(i.due_date) <= today), overdue = dated.filter(i => String(i.due_date) < today);
  return { due, overdue, dueAmount: due.reduce((s,i) => s + number(i.amount) - number(i.paid_amount),0), overdueAmount: overdue.reduce((s,i) => s + number(i.amount) - number(i.paid_amount),0), undated: unique.filter(i => !i.due_date).length };
}
export function nearingExpiry(bookings: BookingRow[], now: number) {
  return bookings.filter(b => b.status === 'pending' && Number.isFinite(Date.parse(b.expires_at)) && Date.parse(b.expires_at) > now && Date.parse(b.expires_at) <= now + 24 * 60 * 60 * 1000);
}
export const distinctBookingAccounts = (bookings: BookingRow[]) => new Set(bookings.map(b => b.user_id).filter(Boolean)).size;
// Confirmed by the owner for existing historical records: no tax arithmetic.
export const ownerAmount = (value: unknown) => number(value);