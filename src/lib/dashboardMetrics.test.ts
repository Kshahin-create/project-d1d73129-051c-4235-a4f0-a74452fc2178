import { describe, it, expect } from 'vitest';
import { aggregateUnits, filterUnits, scopedCollections, scopedBookings, scopedInvoices, overdueInvoices, inPeriod, EMPTY_FILTERS, statusLabel, bookingStatusLabel, clampDashboardPage, executiveSnapshot, type DashboardUnit } from './dashboardMetrics';
import { dashboardUnitExport, dashboardTenantExport, dashboardCollectionExport, dashboardBuildingExport } from './dashboardExport';
const unit = (id: string, status: string, price = 100, building = 1): DashboardUnit => ({ id, status, price, building_number: building, unit_number: Number(id), area: 200, activity: 'ورشة', unit_type: null });
describe('dashboard integrity', () => {
  it('calculates the two executive rates with all units as denominator, including supplemental statuses', () => {
    const units = ['rented','rented','reserved','available','booked','maintenance','unexpected','available'].map((s,i) => unit(String(i),s));
    const summary = executiveSnapshot(units);
    expect(summary.leasing).toBe(25); expect(summary.rentedReservedRate).toBe(37.5);
    expect(summary.counts.rented + summary.counts.reserved + summary.counts.available + summary.counts.booked + summary.counts.maintenance + summary.unknown).toBe(summary.total);
    expect(executiveSnapshot([]).rentedReservedRate).toBe(0);
  });
  it('keeps executive totals and all-period cash independent from detail filters and dates', () => {
    const units = [unit('1','rented',12000),unit('2','reserved',9000),unit('3','available',8000,2)];
    const before = executiveSnapshot(units);
    const details = filterUnits(units,{...EMPTY_FILTERS, building:'2', status:'available', search:'3'});
    expect(details).toHaveLength(1); expect(executiveSnapshot(units)).toEqual(before);
    expect(executiveSnapshot(units,'1').total).toBe(2); expect(before.total).toBe(3);
    const rows = [{id:'c',unit_id:'1',amount:500,is_archived:false,created_at:'2025-01-01'}];
    expect(scopedCollections(rows,details,{from:'2026-10-01',to:'2026-10-31'})).toEqual([]);
    expect(scopedCollections(rows,before.units,{from:'',to:''})).toHaveLength(1);
  });
  it('uses Arabic labels without leaking unknown codes and keeps reservation states separate', () => {
    expect(statusLabel('reserved')).toBe('محجوز'); expect(statusLabel('booked')).toBe('حجز مسجل');
    expect(statusLabel('unexpected')).toBe('حالة غير محددة'); expect(bookingStatusLabel('unexpected')).toBe('حالة غير محددة');
  });
  it('clamps pagination when live datasets shrink, including empty results', () => {
    expect(clampDashboardPage(4, 41, 20)).toBe(3); expect(clampDashboardPage(4, 0, 20)).toBe(1);
    expect(clampDashboardPage(2, 100, 20)).toBe(2);
  });
  it('exports the entire shared filtered set with separate accurate annual and cash columns', () => {
    const units = Array.from({length: 45}, (_, i) => unit(String(i), i === 0 ? 'booked' : 'rented', 12000));
    const tenants = [{id:'t',unit_id:'0',tenant_name:'علي',phone:null,business_name:null,activity_type:null}];
    expect(dashboardUnitExport(units, tenants)).toHaveLength(45);
    expect(dashboardUnitExport(units, tenants)[0]['الحالة الحالية']).toBe('حجز مسجل');
    expect(dashboardTenantExport(units.slice(1), tenants)).toEqual([]);
    const cash = scopedCollections([{id:'c',unit_id:'1',amount:500,is_archived:false,created_at:'2026-10-01'}, {id:'d',unit_id:'1',amount:800,is_archived:true,created_at:'2026-10-01'}], units, {from:'',to:''});
    expect(dashboardCollectionExport(units,cash)).toHaveLength(1);
    const buildings = dashboardBuildingExport([{number:1,...aggregateUnits(units),cash:500}]);
    expect(buildings[0]['قيمة الإيجار السنوي للمؤجر ر.س']).toBe(44 * 12000);
    expect(buildings[0]['التحصيل الفعلي في الفترة ر.س']).toBe(500);
    expect(buildings[0]['حجز مسجل']).toBe(1);
  });
  it('reconciles all statuses without classifying unknown as available', () => {
    const s = aggregateUnits(['rented','reserved','available','maintenance','booked','unexpected'].map((status,i) => unit(String(i),status)));
    expect(s.total).toBe(6); expect(Object.values(s.counts).reduce((a,b) => a+b,0)).toBe(6);
    expect(s.counts.available).toBe(1); expect(s.counts.maintenance).toBe(1); expect(s.unknown).toBe(1); expect(s.leasing).toBeCloseTo(100/6);
  });
  it('handles empty denominators', () => { expect(aggregateUnits([]).leasing).toBe(0); expect(aggregateUnits([]).annual).toBe(0); });
  it('keeps annual value distinct from actual cash and excludes archived payments', () => {
    const units = [unit('1','rented',12000),unit('2','available',9000)];
    const rows = [{id:'a',unit_id:'1',amount:500,is_archived:false,created_at:'2026-10-02T00:00:00Z'},{id:'b',unit_id:'1',amount:800,is_archived:true,created_at:'2026-10-02T00:00:00Z'},{id:'c',unit_id:'2',amount:100,is_archived:false,created_at:'2026-09-02T00:00:00Z'}];
    expect(aggregateUnits(units).rentedAnnual).toBe(12000); expect(aggregateUnits(units).availableAnnual).toBe(9000);
    expect(scopedCollections(rows,units,{from:'2026-10-01',to:'2026-10-31'}).reduce((s,c)=>s+c.amount,0)).toBe(500);
  });
  it('uses one shared unit scope across metrics, cash and booking links', () => {
    const units=[unit('1','rented'),unit('2','available',200,2),unit('3','maintenance')];
    const filtered=filterUnits(units,{...EMPTY_FILTERS,building:'1',status:'rented',activity:'ورشة',search:'علي'},[{id:'t',unit_id:'1',tenant_name:'علي',phone:null,business_name:null,activity_type:null}]);
    expect(filtered.map(u=>u.id)).toEqual(['1']); expect(aggregateUnits(filtered).total).toBe(1);
    expect(scopedCollections([{id:'a',unit_id:'2',amount:500,is_archived:false,created_at:'2026-10-01'}],filtered,{from:'',to:''})).toEqual([]);
    expect(scopedBookings([{id:'b',status:'pending',customer_full_name:'',offer_number:null,created_at:'',expires_at:'',user_id:'',units_count:2}],[{id:'l1',booking_id:'b',unit_id:'1'},{id:'l2',booking_id:'b',unit_id:'2'}],filtered)).toHaveLength(1);
  });
  it('uses Riyadh dates with inclusive period boundaries and rejects invalid dates', () => {
    expect(inPeriod('2026-09-30T22:00:00Z',{from:'2026-10-01',to:'2026-10-01'})).toBe(true);
    expect(inPeriod('invalid',{from:'',to:''})).toBe(false);
  });
  it('requires real dated unpaid obligations and respects explicit unit relationships', () => {
    const rows=[{id:'i',unit_id:null,booking_id:null,tenant_account_id:'a',due_date:'2026-10-01',paid:false,amount:100,paid_amount:25,invoice_number:null,customer_name:null}];
    expect(scopedInvoices(rows,[unit('1','rented')],[],[{id:'l',tenant_account_id:'a',unit_id:'1'}])).toHaveLength(1);
    expect(overdueInvoices(rows,'2026-10-13')).toHaveLength(1);
    expect(overdueInvoices([{...rows[0],due_date:null}],'2026-10-13')).toHaveLength(0);
    expect(overdueInvoices([{...rows[0],paid:true}],'2026-10-13')).toHaveLength(0);
    expect(overdueInvoices([{...rows[0],paid_amount:100}],'2026-10-13')).toHaveLength(0);
  });
});