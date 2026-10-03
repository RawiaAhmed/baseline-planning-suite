import { describe, expect, it } from 'vitest';
import { isoDate, monthCost, rateOn, rateSlicesOf, yearMonth, type RateRecord } from './index';

const rate = (validFrom: string, hourlyCost: number): RateRecord => ({ validFrom: isoDate(validFrom), hourlyCost });

describe('rateOn', () => {
  const rates = [rate('2026-03-12', 95), rate('2025-01-01', 80)]; // unsorted on purpose

  it('returns undefined before the first record', () => {
    expect(rateOn(isoDate('2024-12-31'), rates)).toBeUndefined();
  });

  it('applies the new rate on its validFrom day', () => {
    expect(rateOn(isoDate('2026-03-11'), rates)?.hourlyCost).toBe(80);
    expect(rateOn(isoDate('2026-03-12'), rates)?.hourlyCost).toBe(95);
  });

  it('keeps the last rate open-ended', () => {
    expect(rateOn(isoDate('2030-01-01'), rates)?.hourlyCost).toBe(95);
  });
});

describe('rateSlicesOf', () => {
  it('yields one slice per rate when a month has two changes', () => {
    const rates = [rate('2026-01-01', 100), rate('2026-05-11', 110), rate('2026-05-25', 120)];
    const slices = rateSlicesOf(yearMonth('2026-05'), rates);
    expect(slices.map((s) => s.workingDays)).toEqual([6, 10, 5]);
  });

  it('starts the new slice on the next working day when validFrom is a weekend', () => {
    // 2026-05-16 is a Saturday
    const slices = rateSlicesOf(yearMonth('2026-05'), [rate('2026-01-01', 100), rate('2026-05-16', 110)]);
    expect(slices[1]).toMatchObject({ from: '2026-05-18', hourlyCost: 110 });
  });

  it('merges consecutive records with the same rate into one slice', () => {
    const slices = rateSlicesOf(yearMonth('2026-03'), [rate('2026-01-01', 80), rate('2026-03-12', 80)]);
    expect(slices).toHaveLength(1);
  });
});

describe('monthCost', () => {
  it('costs zero and is marked when the month is before the first rate', () => {
    const result = monthCost(40, yearMonth('2024-12'), [rate('2025-01-01', 80)]);
    expect(result).toEqual({ cost: 0, blendedRate: undefined, hasUnpricedDays: true });
  });

  it('prices only the days from the first rate when it starts mid-month', () => {
    // March 2026: 8 working days before the 12th, 14 from it
    const result = monthCost(88, yearMonth('2026-03'), [rate('2026-03-12', 95)]);
    expect(result.cost).toBeCloseTo(14 * 4 * 95, 10);
    expect(result.hasUnpricedDays).toBe(true);
  });

  it('costs zero hours at zero', () => {
    expect(monthCost(0, yearMonth('2026-03'), [rate('2025-01-01', 80)]).cost).toBe(0);
  });
});
