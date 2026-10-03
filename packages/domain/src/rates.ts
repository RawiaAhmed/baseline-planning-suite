import { sortBy } from 'es-toolkit';
import { workingDaysOf, type IsoDate, type YearMonth } from './calendar';

/** One effective-dated cost rate. It runs from `validFrom` (inclusive) until the next record starts. */
export interface RateRecord {
  readonly validFrom: IsoDate;
  readonly hourlyCost: number;
}

/** A run of consecutive working days in one month priced at one rate. */
export type RateSlice =
  | { readonly kind: 'priced'; readonly from: IsoDate; readonly workingDays: number; readonly hourlyCost: number }
  | { readonly kind: 'unpriced'; readonly from: IsoDate; readonly workingDays: number };

/** The rate in force on a given day, or `undefined` before the first record. */
export function rateOn(day: IsoDate, rates: readonly RateRecord[]): RateRecord | undefined {
  return sortBy(rates, ['validFrom']).findLast((rate) => rate.validFrom <= day);
}

/**
 * Splits a month's working days into slices, one per rate in force.
 * Days before the employee's first rate form an `unpriced` slice.
 */
export function rateSlicesOf(month: YearMonth, rates: readonly RateRecord[]): RateSlice[] {
  const slices: RateSlice[] = [];

  for (const day of workingDaysOf(month)) {
    const hourlyCost = rateOn(day, rates)?.hourlyCost;
    const previous = slices.at(-1);
    const previousCost = previous?.kind === 'priced' ? previous.hourlyCost : undefined;

    if (previous && previousCost === hourlyCost) {
      slices[slices.length - 1] = { ...previous, workingDays: previous.workingDays + 1 };
    } else if (hourlyCost === undefined) {
      slices.push({ kind: 'unpriced', from: day, workingDays: 1 });
    } else {
      slices.push({ kind: 'priced', from: day, workingDays: 1, hourlyCost });
    }
  }

  return slices;
}
