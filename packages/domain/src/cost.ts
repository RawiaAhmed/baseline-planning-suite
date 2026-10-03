import type { YearMonth } from './calendar';
import { rateSlicesOf, type RateRecord, type RateSlice } from './rates';

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
 * month's working days, then each slice is priced at its own rate.
 */
export function monthCost(hours: number, month: YearMonth, rates: readonly RateRecord[]): MonthCost {
  const slices = rateSlicesOf(month, rates);
  const totalDays = slices.reduce((sum, s) => sum + s.workingDays, 0);
  const hoursPerDay = hours / totalDays;

  let cost = 0;
  let pricedDays = 0;
  for (const slice of slices) {
    if (slice.kind === 'priced') {
      cost += slice.workingDays * hoursPerDay * slice.hourlyCost;
      pricedDays += slice.workingDays;
    }
  }

  return {
    cost,
    blendedRate: blendedRateOf(slices),
    hasUnpricedDays: pricedDays < totalDays,
  };
}

/**
 * Cost per hour of any allocation in the month. Effort is spread evenly per
 * working day, so this is the day-weighted rate; unpriced days count as zero.
 * Used to turn a cost typed into a cell back into hours.
 */
function blendedRateOf(slices: readonly RateSlice[]): number | undefined {
  let weighted = 0;
  let totalDays = 0;
  for (const slice of slices) {
    totalDays += slice.workingDays;
    if (slice.kind === 'priced') weighted += slice.workingDays * slice.hourlyCost;
  }
  return weighted === 0 ? undefined : weighted / totalDays;
}
