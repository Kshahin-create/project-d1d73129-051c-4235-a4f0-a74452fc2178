import {describe,it,expect} from "vitest";
import {installmentPreview} from "./finance";
describe("financial precision",()=>{
  it("keeps rental and VAT sums across installments",()=>{
    const rows=installmentPreview(100,15,3);
    expect(rows.map(r=>Math.round(r.amount_excl_vat*100))).toEqual([3333,3333,3334]);
    expect(rows.reduce((s,r)=>s+Math.round(r.vat_amount*100),0)).toBe(1500);
    expect(rows.reduce((s,r)=>s+Math.round(r.amount_incl_vat*100),0)).toBe(11500);
  });
  it("does not assume VAT for an explicitly zero rate",()=>expect(installmentPreview(200,0,1)[0]).toEqual({amount_excl_vat:200,vat_amount:0,amount_incl_vat:200}));
  it("rejects invalid installment count",()=>expect(()=>installmentPreview(100,15,0)).toThrow());
});