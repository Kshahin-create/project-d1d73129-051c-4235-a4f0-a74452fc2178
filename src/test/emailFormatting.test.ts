import { describe, expect, it } from 'vitest';
import { encodeEmailHtml, getEmailUnitArea } from '../../supabase/functions/_shared/email-html';

describe('email Arabic and total areas', () => {
  it('preserves Arabic as transport-safe numeric entities', () => {
    const html = encodeEmailHtml('<p dir="rtl">نخبة تسكين — شكراً</p>');
    expect(html).toMatch(/^<p dir="rtl">&#/);
    expect(html).not.toMatch(/[^\x00-\x7F]/u);
    expect(html).not.toContain('&#65533;');
  });

  it.each([130, 132])('shows workshop total rather than %i ground-floor metres', (area) => {
    expect(getEmailUnitArea({ area, activity: 'مراكز صيانة سيارات', buildingNumber: 1 })).toBe(200);
  });

  it('prefers explicit total area and preserves other unit types', () => {
    expect(getEmailUnitArea({ area: 132, totalArea: 220, buildingNumber: 1 })).toBe(220);
    expect(getEmailUnitArea({ area: 50.46, buildingNumber: 7, activity: 'قطع غيار سيارات' })).toBe(50.46);
    expect(getEmailUnitArea({ area: 132, buildingNumber: 7 })).toBe(132);
  });
});