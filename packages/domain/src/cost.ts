import { sumBy } from 'es-toolkit';
import type { YearMonth } from './calendar';
import { rateSlicesOf, type RateRecord } from './rates';

export interface MonthCost {
  /** Exact cost, not rounded. */
  readonly cost: number;
  /** Cost per hour for this month (cost ÷ hours); `undefined` when no day is priced. */
  readonly blendedRate: number | undefined;
  /** True when some working days fall before the first rate and were costed at zero. */
  readonly hasUnpricedDays: boolean;
}

/**
 * Prices `hours` of effort in `month`. Effort is spread evenly over the
 * month's working days, so the cost is hours × the day-weighted average rate
 * (unpriced days count as zero).
 */
export function monthCost(hours: number, month: YearMonth, rates: readonly RateRecord[]): MonthCost {
  const slices = rateSlicesOf(month, rates);
  const pricedSlices = slices.filter((slice) => slice.kind === 'priced');

  const totalDays = sumBy(slices, (slice) => slice.workingDays);
  const pricedDays = sumBy(pricedSlices, (slice) => slice.workingDays);
  const blendedRate = sumBy(pricedSlices, (slice) => slice.workingDays * slice.hourlyCost) / totalDays;

  return {
    cost: hours * blendedRate,
    blendedRate: pricedDays === 0 ? undefined : blendedRate,
    hasUnpricedDays: pricedDays < totalDays,
  };
}
