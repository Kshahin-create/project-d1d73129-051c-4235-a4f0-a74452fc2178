import {describe,it,expect} from "vitest";
import {statementTotals} from "./statement";
describe("party statement ledger",()=>{
 it("compares installments to verified allocations, not unit prices",()=>{expect(statementTotals([{id:"i",amount_incl_vat:115,status:"due"}],[{id:"r",amount_incl_vat:80,status:"verified",reverses_id:null}],[{receipt_id:"r",installment_id:"i",amount_incl_vat:60}])).toEqual({due:115,allocated:60,balance:55,unallocated:20});});
 it("does not count recorded or reversed original receipts as verified payment",()=>{expect(statementTotals([{id:"i",amount_incl_vat:115,status:"due"}],[{id:"r",amount_incl_vat:115,status:"recorded",reverses_id:null}],[{receipt_id:"r",installment_id:"i",amount_incl_vat:115}]).balance).toBe(115);});
 it("excludes waived installments",()=>expect(statementTotals([{id:"i",amount_incl_vat:115,status:"waived"}],[],[]).due).toBe(0));
 it("nets a reversed original with its negative receipt without negative unallocated cash",()=>expect(statementTotals([],[{id:"original",amount_incl_vat:115,status:"reversed",reverses_id:null},{id:"reversal",amount_incl_vat:-115,status:"verified",reverses_id:"original"}],[]).unallocated).toBe(0));
});