import { eachDayOfInterval, endOfMonth, isWeekend, parseISO } from 'date-fns';

/** Calendar date, `YYYY-MM-DD`. */
export type IsoDate = string & { readonly __brand: 'IsoDate' };

/** Calendar month, `YYYY-MM`. */
export type YearMonth = string & { readonly __brand: 'YearMonth' };

const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isoDate(value: string): IsoDate {
  if (!ISO_DATE.test(value)) throw new Error(`Not an ISO date: "${value}"`);
  return value as IsoDate;
}

export function yearMonth(value: string): YearMonth {
  if (!YEAR_MONTH.test(value)) throw new Error(`Not a year-month: "${value}"`);
  return value as YearMonth;
}

/**
 * Working days of a month, Monday to Friday, in date order.
 * Public holidays are ignored by rule.
 */
export function workingDaysOf(month: YearMonth): IsoDate[] {
  const start = parseISO(`${month}-01`);
  return eachDayOfInterval({ start, end: endOfMonth(start) })
    .filter((day) => !isWeekend(day))
    .map((day) => toIsoDate(day));
}

function toIsoDate(day: Date): IsoDate {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}` as IsoDate;
}
