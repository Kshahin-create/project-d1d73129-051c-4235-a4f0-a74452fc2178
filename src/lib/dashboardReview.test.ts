import { describe, expect, it } from 'vitest';
import { dashboardReview } from './dashboardReview';
import type { DashboardUnit, BookingRow, InvoiceRow } from './dashboardMetrics';
const unit = (status: string): DashboardUnit => ({ id:'u',status,building_number:7,unit_number:85,price:1000,area:50,activity:'بنشر',unit_type:null });
const booking: BookingRow = {id:'b',status:'pending',customer_full_name:'',offer_number:null,created_at:'2026-10-01',expires_at:'2026-10-20',user_id:'a',units_count:1};
describe('read-only evidence review', () => {
  it('flags conflicting pending-unit states once without inferring rental from payment', () => {
    const links = [{id:'l',booking_id:'b',unit_id:'u'},{id:'duplicate',booking_id:'b',unit_id:'u'}];
    expect(dashboardReview([unit('available')],[booking],links,[],[])).toHaveLength(1);
    expect(dashboardReview([unit('rented')],[booking],links,[],[])).toEqual([]);
    expect(dashboardReview([unit('reserved')],[booking],links,[],[])).toEqual([]);
  });
  it('reports missing obligation dates once, not fabricated overdue balances', () => {
    const i: InvoiceRow = {id:'i',unit_id:'u',booking_id:null,tenant_account_id:null,due_date:null,amount:100,paid_amount:25,paid:false,invoice_number:null,customer_name:null};
    expect(dashboardReview([unit('rented')],[],[],[i,i],[])).toHaveLength(1);
    expect(dashboardReview([unit('rented')],[],[],[{...i,paid:true}],[])).toEqual([]);
  });
  it('does not mutate source records', () => {
    const u = Object.freeze(unit('available'));
    dashboardReview([u],[booking],[{id:'l',booking_id:'b',unit_id:'u'}],[],[]);
    expect(u.status).toBe('available');
  });
});