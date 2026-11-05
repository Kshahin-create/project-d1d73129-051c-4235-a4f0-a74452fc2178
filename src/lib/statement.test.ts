import {describe,it,expect} from "vitest";
import {statementTotals} from "./statement";
describe("party statement ledger",()=>{
 it("compares installments to verified allocations, not unit prices",()=>{expect(statementTotals([{id:"i",amount_incl_vat:115,status:"due"}],[{id:"r",amount_incl_vat:80,status:"verified",reverses_id:null}],[{receipt_id:"r",installment_id:"i",amount_incl_vat:60}])).toEqual({due:115,allocated:60,balance:55,unallocated:20});});
 it("does not count recorded or reversed original receipts as verified payment",()=>{expect(statementTotals([{id:"i",amount_incl_vat:115,status:"due"}],[{id:"r",amount_incl_vat:115,status:"recorded",reverses_id:null}],[{receipt_id:"r",installment_id:"i",amount_incl_vat:115}]).balance).toBe(115);});
 it("excludes waived installments",()=>expect(statementTotals([{id:"i",amount_incl_vat:115,status:"waived"}],[],[]).due).toBe(0));
});