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
  let current: RateRecord | undefined;
  for (const rate of sortByValidFrom(rates)) {
    if (rate.validFrom > day) break;
    current = rate;
  }
  return current;
}

/**
 * Splits a month's working days into slices, one per rate in force.
 * Days before the employee's first rate form an `unpriced` slice.
 */
export function rateSlicesOf(month: YearMonth, rates: readonly RateRecord[]): RateSlice[] {
  const slices: RateSlice[] = [];
  for (const day of workingDaysOf(month)) {
    const rate = rateOn(day, rates);
    const last = slices.at(-1);
    if (last && sameRate(last, rate)) {
      slices[slices.length - 1] = { ...last, workingDays: last.workingDays + 1 };
    } else {
      slices.push(
        rate
          ? { kind: 'priced', from: day, workingDays: 1, hourlyCost: rate.hourlyCost }
          : { kind: 'unpriced', from: day, workingDays: 1 },
      );
    }
  }
  return slices;
}

function sameRate(slice: RateSlice, rate: RateRecord | undefined): boolean {
  if (!rate) return slice.kind === 'unpriced';
  return slice.kind === 'priced' && slice.hourlyCost === rate.hourlyCost;
}

function sortByValidFrom(rates: readonly RateRecord[]): RateRecord[] {
  return [...rates].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
}
