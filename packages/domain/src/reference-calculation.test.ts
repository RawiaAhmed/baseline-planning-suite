import { describe, expect, it } from 'vitest';
import { isoDate, monthCost, rateSlicesOf, workingDaysOf, yearMonth, type RateRecord } from './index';

/**
 * Figure 4 of the case study: A. Okafor (emp-001), 40 h/week,
 * €80/h from 2025-01-01 and €95/h from 2026-03-12, 0.50 PM in March 2026 = 88 h.
 */
const okafor: RateRecord[] = [
  { validFrom: isoDate('2025-01-01'), hourlyCost: 80 },
  { validFrom: isoDate('2026-03-12'), hourlyCost: 95 },
];
const march = yearMonth('2026-03');

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
});
