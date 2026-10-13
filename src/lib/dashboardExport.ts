import { aggregateUnits, statusLabel, type DashboardUnit, type TenantRow, type CollectionRow } from './dashboardMetrics';

export function dashboardUnitExport(units: DashboardUnit[], tenants: TenantRow[]) {
  return units.map(u => ({ 'المبنى': u.building_number, 'الوحدة': u.unit_number, 'الحالة الحالية': statusLabel(u.status), 'النشاط': u.activity ?? 'غير مسجل', 'المستأجر المسجل': tenants.filter(t => t.unit_id === u.id).map(t => t.tenant_name).join('، ') || 'غير مسجل', 'المساحة م²': u.area, 'قيمة الإيجار السنوي ر.س': u.price }));
}
export function dashboardTenantExport(units: DashboardUnit[], tenants: TenantRow[]) {
  const byId = new Map(units.map(u => [u.id, u]));
  return tenants.flatMap(t => {
    const u = byId.get(t.unit_id);
    return u ? [{ 'المستأجر': t.tenant_name, 'العلامة التجارية': t.business_name ?? 'غير مسجلة', 'الجوال': t.phone ?? 'غير مسجل', 'المبنى': u.building_number, 'الوحدة': u.unit_number, 'الحالة الحالية للوحدة': statusLabel(u.status), 'النشاط المسجل للمستأجر': t.activity_type ?? 'غير مسجل' }] : [];
  });
}
export function dashboardCollectionExport(units: DashboardUnit[], collections: CollectionRow[]) {
  const byId = new Map(units.map(u => [u.id, u]));
  return [...collections].sort((a, b) => b.created_at.localeCompare(a.created_at)).flatMap(c => {
    const u = byId.get(c.unit_id);
    return u ? [{ 'تاريخ تسجيل التحصيل (الرياض)': new Date(c.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh' }), 'المبنى': u.building_number, 'الوحدة': u.unit_number, 'المبلغ ر.س': c.amount }] : [];
  });
}
export function dashboardBuildingExport(rows: (ReturnType<typeof aggregateUnits> & { number: number; cash: number })[]) {
  return rows.map(b => ({ 'المبنى': b.number, 'الوحدات المطابقة': b.total, 'مؤجر': b.counts.rented, 'محجوز': b.counts.reserved, 'حجز مسجل': b.counts.booked, 'متاح': b.counts.available, 'صيانة': b.counts.maintenance, 'حالة غير محددة': b.unknown, 'نسبة التأجير من الوحدات المطابقة %': b.leasing, 'قيمة الإيجار السنوي للمؤجر ر.س': b.rentedAnnual, 'قيمة الإيجار السنوي للمتاح ر.س': b.availableAnnual, 'التحصيل الفعلي في الفترة ر.س': b.cash }));
}