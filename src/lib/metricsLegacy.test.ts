import { describe, expect, it } from 'vitest';
import { legacyFinanceTiles, legacySetupSteps, type LegacyFinance } from './metrics';
const base:LegacyFinance={as_of:'2026-11-07',period:{from:'2026-11-01',to:'2026-11-07'},collections_count:37,collections_excl:919875.64,collections_period_count:0,collections_period_excl:0,invoices_count:18,invoices_excl:395070.01,invoices_paid_excl:362570.01,invoices_remaining_excl:32500,leased_without_contract:37,receipts_recorded:54,receipts_without_paid_at:54,legacy_sources_review:54};
describe('legacy finance display',()=>{
 it('shows legacy collections exactly as stored, without VAT conversion',()=>{expect(legacyFinanceTiles(base)[0].value).toBe(919875.64);});
 it('never offers a combined total of collections and invoice payments',()=>{expect(legacyFinanceTiles(base).map(t=>t.value)).not.toContain(919875.64+362570.01);});
 it('lists 37 leased units without an active contract as a setup step',()=>{expect(legacySetupSteps(base)[0]).toEqual({label:'وحدات مؤجرة بدون عقد فعّال',count:37,to:'/admin/contracts'});});
 it('hides the setup card once contracts and receipts are complete',()=>{expect(legacySetupSteps({...base,leased_without_contract:0,receipts_recorded:0,receipts_without_paid_at:0,legacy_sources_review:0})).toEqual([]);});
});
