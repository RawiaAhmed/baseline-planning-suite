import { describe, expect, it } from 'vitest';
import { fromHours, isoDate, monthsBetween, personMonthHours, toHours, yearMonth, type CellContext, type DisplayUnit } from './index';

const cell: CellContext = {
  month: yearMonth('2026-03'),
  weeklyHours: 32,
  rates: [
    { validFrom: isoDate('2025-01-01'), hourlyCost: 80 },
    { validFrom: isoDate('2026-03-12'), hourlyCost: 95 },
  ],
};
const units: DisplayUnit[] = ['hours', 'personMonths', 'percent', 'cost'];

describe('personMonthHours', () => {
  it('varies by person and by month', () => {
    expect(personMonthHours(32, yearMonth('2026-03'))).toBeCloseTo(140.8, 10); // 22 days
    expect(personMonthHours(20, yearMonth('2026-02'))).toBe(80); // 20 days
  });
});

describe('unit round trip', () => {
  it.each(units)('hours → %s → hours returns the same hours', (unit) => {
    const hours = 37.123456;
    const back = toHours(fromHours(hours, unit, cell), unit, cell);
    expect(back.ok && back.hours).toBeCloseTo(hours, 9);
  });
});

describe('toHours', () => {
  it('rejects negative and non-numeric input', () => {
    expect(toHours(-1, 'hours', cell)).toEqual({ ok: false, reason: 'negative' });
    expect(toHours(Number.NaN, 'hours', cell)).toEqual({ ok: false, reason: 'not-a-number' });
  });

  it('cannot turn € into hours in a month with no rate', () => {
    const unpriced: CellContext = { ...cell, month: yearMonth('2024-06') };
    expect(toHours(100, 'cost', unpriced)).toEqual({ ok: false, reason: 'no-rate' });
    expect(toHours(0, 'cost', unpriced)).toEqual({ ok: true, hours: 0 });
  });
});

describe('monthsBetween', () => {
  it('lists every month of a project, inclusive', () => {
    const months = monthsBetween(isoDate('2026-03-01'), isoDate('2027-02-28'));
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2026-03');
    expect(months.at(-1)).toBe('2027-02');
  });
});
