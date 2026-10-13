import { describe, it, expect } from 'vitest';
import { aggregateUnits, filterUnits, scopedCollections, scopedBookings, scopedInvoices, overdueInvoices, inPeriod, EMPTY_FILTERS, type DashboardUnit } from './dashboardMetrics';
const unit = (id: string, status: string, price = 100, building = 1): DashboardUnit => ({ id, status, price, building_number: building, unit_number: Number(id), area: 200, activity: 'ورشة', unit_type: null });
describe('dashboard integrity', () => {
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