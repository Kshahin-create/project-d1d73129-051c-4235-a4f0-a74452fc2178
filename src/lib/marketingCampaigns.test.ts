import { describe, expect, it } from 'vitest';
import { audience, normalizePhone, templateComponents, outcome } from '../../supabase/functions/respond-campaigns/logic';
describe('marketing campaign rules', () => {
  it('unifies Saudi local, international and Arabic digit numbers', () => {
    expect(normalizePhone('٠٥٠١٢٣٤٥٦٧')).toBe('+966501234567');
    expect(normalizePhone('00966501234567')).toBe('+966501234567');
    expect(normalizePhone('966501234567')).toBe('+966501234567');
    expect(normalizePhone('123')).toBeNull();
  });
  it('includes registered and manually entered customers once across all sources', () => {
    const result = audience([{ phone:'0501234567',source:'المستخدمون' },{ phone:'+966501234567',source:'المستهدفون' },{ phone:'0551234567',source:'المهتمون' },{ phone:'123',source:'الحجوزات' }]);
    expect(result.summary).toMatchObject({total:2,duplicates:1,invalid:1});
    expect(result.recipients[0].sources).toEqual(['المستخدمون','المستهدفون']);
  });
  it('preserves template variable order and omits unneeded components', () => {
    expect(templateComponents([], '', '')).toEqual([]);
    expect(templateComponents(['أ','ب'], '', '')).toEqual([{type:'body',parameters:[{type:'text',text:'أ'},{type:'text',text:'ب'}]}]);
  });
  it('never treats a timeout or upstream failure as a safe resend', () => {
    expect(outcome(200)).toBe('accepted'); expect(outcome(400)).toBe('failed');
    expect(outcome(408)).toBe('unknown'); expect(outcome(503)).toBe('unknown');
  });
});