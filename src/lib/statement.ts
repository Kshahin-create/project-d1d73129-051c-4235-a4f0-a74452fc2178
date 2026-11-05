export type StatementInstallment = {id:string;amount_incl_vat:unknown;status:unknown};
export type StatementReceipt = {id:string;amount_incl_vat:unknown;status:unknown;reverses_id:unknown};
export type StatementAllocation = {receipt_id:string;installment_id:string;amount_incl_vat:unknown};
export function statementTotals(installments:StatementInstallment[],receipts:StatementReceipt[],allocations:StatementAllocation[]) {
 const valid=new Set(receipts.filter(r=>r.status==="verified").map(r=>r.id));
 const payable=new Set(installments.filter(i=>i.status!=="waived").map(i=>i.id));
 const due=installments.filter(i=>payable.has(i.id)).reduce((sum,i)=>sum+Number(i.amount_incl_vat),0);
 const paid=allocations.filter(a=>valid.has(a.receipt_id)&&payable.has(a.installment_id)).reduce((sum,a)=>sum+Number(a.amount_incl_vat),0);
 const cash=receipts.filter(r=>r.status==="verified"||r.status==="reversed").reduce((sum,r)=>sum+Number(r.amount_incl_vat),0);
 return{due:Math.round(due*100)/100,allocated:Math.round(paid*100)/100,balance:Math.round((due-paid)*100)/100,unallocated:Math.round((cash-paid)*100)/100};
}