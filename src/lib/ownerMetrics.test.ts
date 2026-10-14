import { describe,it,expect } from 'vitest';
import { ownerProgress,statusTransitions,activityPerformance,invoiceObligations,ownerAmount,nearingExpiry,distinctBookingAccounts,type StatusEvent } from './ownerMetrics';
import { aggregateUnits,type DashboardUnit,type BookingRow,type InvoiceRow } from './dashboardMetrics';
const u=(id:string,status='rented',activity:string|null='مراكز صيانة سيارات'):DashboardUnit=>({id,status,activity,building_number:1,unit_number:1,price:1000,area:200,unit_type:null});
const b=(id:string):BookingRow=>({id,user_id:'account',status:'pending',created_at:'2026-10-01',expires_at:'2026-10-15T00:00:00Z',customer_full_name:'',offer_number:null,units_count:3});
const e=(id:string,entity_id='1'):StatusEvent=>({id,entity_id,entity_table:'units',action:'UPDATE',before_status:'reserved',after_status:'rented',created_at:'2026-10-02T00:00:00Z'});
const range={from:'2026-10-01',to:'2026-10-31'};
describe('owner reporting',()=>{
 it('counts only genuine transitions and deduplicates duplicate action records, not insert snapshots',()=>{
  const rows=[e('a'),e('duplicate'),{...e('insert'),action:'INSERT',before_status:null},{...e('same'),before_status:'rented'}, {...e('old','2'),created_at:'2026-09-01'},e('outside','gone')];
  expect(statusTransitions(rows,'units',new Set(['1','2']),range)).toHaveLength(1);
 });
 it('counts new requests separately from units and distinct account identities',()=>{
  const rows=[b('b1'),b('b1'),b('b2')];
  const progress=ownerProgress([u('1')],rows,[e('a'),{...e('again'),created_at:'2026-10-03'}],range);
  expect(progress.requests).toHaveLength(2);expect(progress.rentedUnits).toBe(1);expect(progress.rentedEvents).toHaveLength(2);expect(distinctBookingAccounts(rows)).toBe(1);
 });
 it('uses stored reserved request state and manual rented state without balance thresholds',()=>{
  expect(aggregateUnits([u('1','reserved'),u('2','rented'),u('3','booked')]).counts).toMatchObject({reserved:1,rented:1,booked:1});
  expect(aggregateUnits([u('1','reserved')]).rentedAnnual).toBe(0);
 });
 it('does not transform confirmed VAT-exclusive historical amounts',()=>{
  expect(ownerAmount(1150)).toBe(1150);expect(ownerAmount('902011.636')).toBe(902011.636);
 });
 it('maps only actual activity labels, retaining unknown activity totals',()=>{
  const perf=activityPerformance([u('1'),u('2','reserved','قطع غيار سيارات'),u('3','available','بنشر'),u('4','available','غير معروف'),u('5','maintenance',null)]);
  expect(perf.groups.map(g=>g.total)).toEqual([1,1,1]);expect(perf.unknown).toHaveLength(2);
  expect(perf.groups.reduce((s,g)=>s+g.total,0)+perf.unknown.length).toBe(5);
 });
 it('counts shared invoices once, excludes undated and future obligations, distinguishes overdue as a subset',()=>{
  const i:InvoiceRow={id:'i',unit_id:null,booking_id:null,tenant_account_id:'a',amount:100,paid_amount:25,paid:false,due_date:'2026-10-13',invoice_number:null,customer_name:null};
  const result=invoiceObligations([i,i,{...i,id:'today',due_date:'2026-10-14'},{...i,id:'future',due_date:'2026-10-15'},{...i,id:'undated',due_date:null},{...i,id:'paid',paid:true}], '2026-10-14');
  expect(result.dueAmount).toBe(150);expect(result.overdueAmount).toBe(75);expect(result.undated).toBe(1);
 });
 it('uses recorded expiry within next 24 hours, never already expired or confirmed',()=>{
  expect(nearingExpiry([b('1'),{...b('2'),status:'confirmed'},{...b('3'),expires_at:'invalid'}],Date.parse('2026-10-14T12:00:00Z'))).toHaveLength(1);
 });
 it('assigns events to Riyadh dates and never synthesizes missing intermediate steps',()=>{
  const event={...e('boundary'),before_status:'available',created_at:'2026-09-30T21:00:00Z'};
  expect(statusTransitions([event],'units',new Set(['1']),{from:'2026-10-01',to:'2026-10-01'},'rented')).toHaveLength(1);
  expect(statusTransitions([{...event,before_status:null}],'units',new Set(['1']),range)).toHaveLength(0);
  expect(statusTransitions([{...event,created_at:'invalid'}],'units',new Set(['1']),range)).toHaveLength(0);
 });
});