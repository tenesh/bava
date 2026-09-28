import { describe, expect, it } from 'vitest';
import { dateAttrs, formatDay, isDay } from './dates';

describe('a day', () => {
  it('is a real day written YYYY-MM-DD', () => {
    expect(isDay('2026-10-02')).toBe(true);
    expect(isDay('2028-02-29')).toBe(true);
    expect(isDay('2026-02-29')).toBe(false);
    expect(isDay('2026-13-01')).toBe(false);
    expect(isDay('2026-1-02')).toBe(false);
    expect(isDay('2026-10-02T10:00')).toBe(false);
  });

  it('reads as day, short month and year, in English', () => {
    expect(formatDay('2026-10-02')).toBe('2 Oct 2026');
    expect(formatDay('2027-01-31')).toBe('31 Jan 2027');
    expect(dateAttrs('2026-12-25')).toEqual({ date: '2026-12-25', text: '25 Dec 2026' });
  });
});
