export type DashboardUnit = {
  id: string; building_number: number; unit_number: number; status: string;
  price: number; area: number; activity: string | null; unit_type: string | null;
};
export type CollectionRow = { id: string; unit_id: string; amount: number; is_archived: boolean; created_at: string };
export type BookingRow = { id: string; status: string; customer_full_name: string; offer_number: string | null; created_at: string; expires_at: string; user_id: string; units_count: number };
export type BookingUnitRow = { id: string; booking_id: string; unit_id: string };
export type TenantRow = { id: string; unit_id: string; tenant_name: string; business_name: string | null; phone: string | null; activity_type: string | null };
export type InvoiceRow = { id: string; unit_id: string | null; booking_id: string | null; tenant_account_id: string | null; due_date: string | null; paid: boolean; amount: number; paid_amount: number; invoice_number: string | null; customer_name: string | null };
export type AccountUnitRow = { id: string; tenant_account_id: string; unit_id: string };
export type DashboardFilters = { building: string; activity: string; status: string; search: string };
export type DateRange = { from: string; to: string };
export const EMPTY_FILTERS: DashboardFilters = { building: 'all', activity: 'all', status: 'all', search: '' };
export const STATUS_LABELS: Record<string, string> = { rented: 'مؤجر', reserved: 'محجوز', booked: 'حجز مسجل', available: 'متاح', maintenance: 'صيانة' };
export const statusLabel = (status: string) => STATUS_LABELS[status] ?? 'حالة غير محددة';
export const bookingStatusLabel = (status: string) => ({ pending: 'قيد الانتظار', confirmed: 'مؤكد', cancelled: 'ملغي', expired: 'منتهي' } as Record<string, string>)[status] ?? 'حالة غير محددة';
export const clampDashboardPage = (page: number, total: number, pageSize: number) => Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / pageSize)));
export const statusClass = (status: string) => ({ rented: 'bg-primary/10 text-primary border-primary/20', reserved: 'bg-accent/15 text-accent-foreground border-accent/30', booked: 'bg-secondary text-secondary-foreground border-primary/30', available: 'bg-success/10 text-success border-success/25', maintenance: 'bg-destructive/10 text-destructive border-destructive/20' }[status] ?? 'bg-muted text-muted-foreground border-border');
export const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
export const fmt = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });
export const inPeriod = (timestamp: string, range: DateRange) => {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return false;
  // Collection timestamps are reported in the project's Saudi local calendar.
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  return (!range.from || day >= range.from) && (!range.to || day <= range.to);
};
export function filterUnits(units: DashboardUnit[], filters: DashboardFilters, tenants: TenantRow[] = []) {
  const names = new Map<string, string>();
  for (const t of tenants) names.set(t.unit_id, `${names.get(t.unit_id) ?? ''} ${t.tenant_name} ${t.business_name ?? ''} ${t.phone ?? ''}`);
  const search = filters.search.trim().toLowerCase();
  return units.filter(u => (filters.building === 'all' || String(u.building_number) === filters.building)
    && (filters.activity === 'all' || (u.activity ?? '__none') === filters.activity)
    && (filters.status === 'all' || u.status === filters.status)
    && (!search || `${u.building_number} ${u.unit_number} ${u.activity ?? ''} ${u.unit_type ?? ''} ${names.get(u.id) ?? ''}`.toLowerCase().includes(search)));
}
export function aggregateUnits(units: DashboardUnit[]) {
  const counts: Record<string, number> = { rented: 0, reserved: 0, booked: 0, available: 0, maintenance: 0 };
  let unknown = 0, rentedAnnual = 0, availableAnnual = 0, annual = 0;
  for (const unit of units) {
    counts[unit.status] = (counts[unit.status] ?? 0) + 1;
    if (!Object.prototype.hasOwnProperty.call(STATUS_LABELS, unit.status)) unknown++;
    annual += number(unit.price);
    if (unit.status === 'rented') rentedAnnual += number(unit.price);
    if (unit.status === 'available') availableAnnual += number(unit.price);
  }
  return { total: units.length, counts, unknown, rentedAnnual, availableAnnual, annual, leasing: units.length ? counts.rented / units.length * 100 : 0 };
}
export function scopedCollections(rows: CollectionRow[], units: DashboardUnit[], range: DateRange) {
  const ids = new Set(units.map(u => u.id));
  return rows.filter(c => !c.is_archived && ids.has(c.unit_id) && inPeriod(c.created_at, range));
}
export function scopedBookings(rows: BookingRow[], links: BookingUnitRow[], units: DashboardUnit[]) {
  const ids = new Set(units.map(u => u.id));
  const bookingIds = new Set(links.filter(l => ids.has(l.unit_id)).map(l => l.booking_id));
  return rows.filter(b => bookingIds.has(b.id));
}
export function scopedInvoices(rows: InvoiceRow[], units: DashboardUnit[], bookingLinks: BookingUnitRow[], accountLinks: AccountUnitRow[]) {
  const ids = new Set(units.map(u => u.id));
  return rows.filter(row => row.unit_id ? ids.has(row.unit_id)
    : row.booking_id ? bookingLinks.some(l => l.booking_id === row.booking_id && ids.has(l.unit_id))
    : row.tenant_account_id ? accountLinks.some(l => l.tenant_account_id === row.tenant_account_id && ids.has(l.unit_id)) : false);
}
export const overdueInvoices = (rows: InvoiceRow[], today: string) => rows.filter(i => !i.paid && i.due_date && i.due_date < today && number(i.amount) > number(i.paid_amount));
export function collectionTrend(rows: CollectionRow[]) {
  const months = new Map<string, { month: string; amount: number; payments: number }>();
  for (const row of rows) {
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit' }).format(new Date(row.created_at));
    const item = months.get(month) ?? { month, amount: 0, payments: 0 };
    item.amount += number(row.amount); item.payments++; months.set(month, item);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}