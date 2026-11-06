import {describe,it,expect} from 'vitest';
import {bookingResponseAt,beforeDays,beforeCalendarMonths,saudiMidnight} from './tasks';
describe('approved follow-up deadlines',()=>{
 it('booking response maximum is 24 hours',()=>expect(bookingResponseAt('2026-11-06T00:05:00Z',24)).toBe('2026-11-07T00:05:00.000Z'));
 it('installment reminder is three days before',()=>expect(beforeDays('2026-11-10',3)).toBe('2026-11-07'));
 it('contract first reminder is a calendar month',()=>expect(beforeCalendarMonths('2026-03-31',1)).toBe('2026-02-28'));
 it('calendar month respects leap years',()=>expect(beforeCalendarMonths('2028-03-31',1)).toBe('2028-02-29'));
 it('contract second reminder is seven days',()=>expect(beforeDays('2026-12-01',7)).toBe('2026-11-24'));
 it('12 AM Saudi is 21 UTC on previous day',()=>expect(saudiMidnight('2026-11-07')).toBe('2026-11-06T21:00:00.000Z'));
});