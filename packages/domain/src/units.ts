import { workingDaysOf, type YearMonth } from './calendar';
import { monthCost } from './cost';
import type { RateRecord } from './rates';

/** Contracted hours per week. Only these three contracts exist. */
export type WeeklyHours = 40 | 32 | 20;

/** The four ways a staffing cell can be read and edited. Hours is the stored unit. */
export type DisplayUnit = 'hours' | 'personMonths' | 'percent' | 'cost';

/** Fixed display precision per unit. */
export const DECIMALS: Readonly<Record<DisplayUnit, number>> = {
  hours: 2,
  personMonths: 2,
  percent: 1,
  cost: 2,
};

/** What a cell needs to convert between hours and any display unit. */
export interface CellContext {
  readonly month: YearMonth;
  readonly weeklyHours: WeeklyHours;
  readonly rates: readonly RateRecord[];
}

/** One person-month in hours: weekly hours × (working days ÷ 5). Varies by person and month. */
export function personMonthHours(weeklyHours: WeeklyHours, month: YearMonth): number {
  return (weeklyHours * workingDaysOf(month).length) / 5;
}

/** Stored hours → exact (unrounded) value in `unit`. */
export function fromHours(hours: number, unit: DisplayUnit, cell: CellContext): number {
  switch (unit) {
    case 'hours':
      return hours;
    case 'personMonths':
      return hours / personMonthHours(cell.weeklyHours, cell.month);
    case 'percent':
      return (100 * hours) / personMonthHours(cell.weeklyHours, cell.month);
    case 'cost':
      return monthCost(hours, cell.month, cell.rates).cost;
  }
}

export type ToHoursResult =
  | { readonly ok: true; readonly hours: number }
  | { readonly ok: false; readonly reason: 'no-rate' | 'negative' | 'not-a-number' };

/**
 * A value typed in `unit` → hours to store.
 * Cost is divided by the cell's blended rate; it cannot be converted when no day of the month is priced.
 */
export function toHours(value: number, unit: DisplayUnit, cell: CellContext): ToHoursResult {
  if (!Number.isFinite(value)) return { ok: false, reason: 'not-a-number' };
  if (value < 0) return { ok: false, reason: 'negative' };

  switch (unit) {
    case 'hours':
      return { ok: true, hours: value };
    case 'personMonths':
      return { ok: true, hours: value * personMonthHours(cell.weeklyHours, cell.month) };
    case 'percent':
      return { ok: true, hours: (value / 100) * personMonthHours(cell.weeklyHours, cell.month) };
    case 'cost': {
      if (value === 0) return { ok: true, hours: 0 };
      const { blendedRate } = monthCost(1, cell.month, cell.rates);
      return blendedRate === undefined ? { ok: false, reason: 'no-rate' } : { ok: true, hours: value / blendedRate };
    }
  }
}
