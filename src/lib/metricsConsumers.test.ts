import { describe, expect, it, vi } from 'vitest';
import { legacyMetricUnits, metricsSnapshot, metricsActorSnapshot, metricsPeriod } from '../../supabase/functions/_shared/metrics';
describe('central metric consumers',()=>{
 it('does not turn unavailable inventory into zero',()=>{expect(legacyMetricUnits({inventory:{unavailable:true}}).reserved).toBeNull();});
 it('projects server groups without double counting activities',()=>{expect(legacyMetricUnits({inventory:{groups:[{dimension:'building',status:'on_hold',count:2},{dimension:'building',status:'pending_contract',count:1},{dimension:'activity',status:'on_hold',count:2}]}}).reserved).toBe(3);});
 it('uses the service snapshot rather than independent finance reads',async()=>{const rpc=vi.fn().mockResolvedValue({data:{finance:{collected_excl:60}},error:null});expect(await metricsSnapshot({rpc},{building:'7'})).toEqual({finance:{collected_excl:60}});expect(rpc).toHaveBeenCalledWith('metrics_service_snapshot',{_scope:{building:'7'}});});
 it('passes trusted subscriber identity to role checked snapshots',async()=>{const rpc=vi.fn().mockResolvedValue({data:{audience:'control'},error:null});await metricsActorSnapshot({rpc},'actor',{building:'7'});expect(rpc).toHaveBeenCalledWith('metrics_telegram_snapshot',{_actor:'actor',_scope:{building:'7'}});});
 it('propagates failures instead of returning empty finance',async()=>{await expect(metricsSnapshot({rpc:async()=>({error:new Error('unavailable')})})).rejects.toThrow('unavailable');});
 it('uses the Riyadh date at UTC month boundary',()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-31T22:00:00Z'));expect(metricsPeriod(1)).toEqual({from:'2026-11-01',to:'2026-11-01'});vi.useRealTimers();});
});