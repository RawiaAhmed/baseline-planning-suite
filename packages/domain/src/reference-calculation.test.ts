import { describe, expect, it } from 'vitest';
import {
  fromHours,
  isoDate,
  monthCost,
  personMonthHours,
  rateSlicesOf,
  roundTo,
  toHours,
  workingDaysOf,
  yearMonth,
  type CellContext,
  type RateRecord,
} from './index';

/**
 * Figure 4 of the case study: A. Okafor (emp-001), 40 h/week,
 * €80/h from 2025-01-01 and €95/h from 2026-03-12, 0.50 PM in March 2026 = 88 h.
 */
const okafor: RateRecord[] = [
  { validFrom: isoDate('2025-01-01'), hourlyCost: 80 },
  { validFrom: isoDate('2026-03-12'), hourlyCost: 95 },
];
const march = yearMonth('2026-03');
const cell: CellContext = { month: march, weeklyHours: 40, rates: okafor };

describe('Figure 4 reference calculation', () => {
  it('March 2026 has 22 working days', () => {
    expect(workingDaysOf(march)).toHaveLength(22);
  });

  it('splits 8 days at the old rate and 14 from 12 March on (validFrom inclusive)', () => {
    expect(rateSlicesOf(march, okafor)).toEqual([
      { kind: 'priced', from: '2026-03-02', workingDays: 8, hourlyCost: 80 },
      { kind: 'priced', from: '2026-03-12', workingDays: 14, hourlyCost: 95 },
    ]);
  });

  it('prices 88 h at €7,880.00 with a blended rate of €89.5455/h', () => {
    const result = monthCost(88, march, okafor);
    expect(result.cost).toBeCloseTo(7880, 10);
    expect(result.blendedRate).toBeCloseTo(89.5455, 4);
    expect(result.hasUnpricedDays).toBe(false);
  });

  it('one person-month is 40 × 22 ÷ 5 = 176.00 h', () => {
    expect(personMonthHours(40, march)).toBe(176);
  });

  it('0.50 PM is 88.00 h and 50.0% of capacity', () => {
    const result = toHours(0.5, 'personMonths', cell);
    expect(result).toEqual({ ok: true, hours: 88 });
    expect(roundTo(fromHours(88, 'percent', cell), 1)).toBe(50);
  });

  it('typing €7,880.00 into the cell stores 88 h', () => {
    const result = toHours(7880, 'cost', cell);
    expect(result.ok && result.hours).toBeCloseTo(88, 10);
  });
});
