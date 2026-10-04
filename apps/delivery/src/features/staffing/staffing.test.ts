import type { Allocation, BreakdownItem, Employee, RateRecord } from '@baseline/contracts';
import { yearMonth, type DisplayUnit } from '@baseline/domain';
import { describe, expect, it } from 'vitest';
import { buildGrid, type GridInput, type GridRow } from './staffing';

// Figure 4: A. Okafor, 40 h/week, €80 then €95 from 12 March 2026, 0.50 PM (88 h) in March 2026.
const okafor: Employee = { id: 'emp-001', name: 'Adaeze Okafor', role: 'Tech Lead', weeklyHours: 40 };
const brandt: Employee = { id: 'emp-003', name: 'Milan Brandt', role: 'Backend Engineer', weeklyHours: 40 };
const rates: RateRecord[] = [
  { id: 'rate-001', employeeId: 'emp-001', validFrom: '2025-01-01', hourlyCost: 80 },
  { id: 'rate-002', employeeId: 'emp-001', validFrom: '2026-03-12', hourlyCost: 95 },
  { id: 'rate-004', employeeId: 'emp-003', validFrom: '2026-04-01', hourlyCost: 100 },
];
const items: BreakdownItem[] = [
  { id: 'wbs-001', projectId: 'prj-1', parentId: null, name: 'Ledger migration' },
  { id: 'wbs-004', projectId: 'prj-1', parentId: 'wbs-001', name: 'Discovery' },
  { id: 'wbs-012', projectId: 'prj-1', parentId: 'wbs-004', name: 'Design' },
  { id: 'wbs-020', projectId: 'prj-1', parentId: 'wbs-004', name: 'Rework' },
];
const allocation = (id: string, itemId: string, employeeId: string, month: string, hours: number, updatedAt = '2026-01-01T00:00:00Z'): Allocation => ({
  id,
  breakdownItemId: itemId,
  employeeId,
  month,
  hours,
  updatedAt,
});

const grid = (unit: DisplayUnit, overrides: Partial<GridInput> = {}): GridRow[] =>
  buildGrid({
    items,
    allocations: [allocation('alloc-001', 'wbs-012', 'emp-001', '2026-03', 88)],
    employees: [okafor, brandt],
    rates,
    months: [yearMonth('2026-03'), yearMonth('2026-04')],
    unit,
    perEuro: 1,
    ...overrides,
  });

const row = (rows: GridRow[], key: string) => rows.find((r) => r.key === key);
const march = (r: GridRow | undefined) => r?.cells[0];

describe('staffing grid: Figure 4 cell in every unit', () => {
  it.each([
    ['hours', 88],
    ['personMonths', 0.5],
    ['percent', 50],
    ['cost', 7880],
  ] as const)('shows %s as %d', (unit, expected) => {
    expect(march(row(grid(unit), 'wbs-012|emp-001'))?.value).toBe(expected);
  });

  it('converts cost into the shell’s display currency', () => {
    expect(march(row(grid('cost', { perEuro: 1.08 }), 'wbs-012|emp-001'))?.value).toBe(8510.4);
  });
});

describe('staffing grid: derived rows (R4)', () => {
  it('rolls the leaf up through every parent', () => {
    const rows = grid('personMonths');
    expect(march(row(rows, 'wbs-012'))?.value).toBe(0.5);
    expect(march(row(rows, 'wbs-004'))?.value).toBe(0.5);
    expect(march(row(rows, 'wbs-001'))?.value).toBe(0.5);
  });

  it('lists rows in tree order with people under their leaf', () => {
    expect(grid('hours').map((r) => r.key)).toEqual(['wbs-001', 'wbs-004', 'wbs-012', 'wbs-012|emp-001', 'wbs-020']);
  });

  it('shows a person added in the UI before they have any effort', () => {
    const rows = grid('hours', { addedPeople: new Map([['wbs-020', ['emp-003']]]) });
    expect(row(rows, 'wbs-020|emp-003')?.total).toBe(0);
  });
});

describe('staffing grid: markers', () => {
  it('marks effort in a month before the first rate as unpriced (R1)', () => {
    const rows = grid('cost', { allocations: [allocation('a', 'wbs-020', 'emp-003', '2026-03', 10)] });
    expect(march(row(rows, 'wbs-020|emp-003'))).toMatchObject({ value: 0, unpriced: true });
  });

  it('names the latest edit as the cause of an over-capacity month (R5)', () => {
    const rows = grid('percent', {
      allocations: [
        allocation('older', 'wbs-012', 'emp-001', '2026-03', 100, '2026-10-01T09:00:00Z'),
        allocation('newer', 'wbs-020', 'emp-001', '2026-03', 100, '2026-10-02T09:00:00Z'),
      ],
    });
    expect(march(row(rows, 'wbs-012|emp-001'))?.overCapacity).toBeUndefined();
    expect(march(row(rows, 'wbs-020|emp-001'))?.overCapacity).toMatchObject({ overCapacity: true, causedBy: 'newer' });
  });
});

describe('staffing grid: totals reconcile (R3)', () => {
  it('rounds each row so its cells add up to its total', () => {
    // A third of a person-month in each of three months: naive rounding shows 0.33 × 3 = 0.99 against a 1.00 total
    const months = ['2026-03', '2026-04', '2026-05'];
    const personMonthHours = [176, 176, 168]; // 22, 22 and 21 working days at 40 h/week
    const rows = grid('personMonths', {
      months: months.map(yearMonth),
      allocations: months.map((month, i) => allocation(`a${i}`, 'wbs-012', 'emp-001', month, (personMonthHours[i] ?? 0) / 3)),
    });
    const person = row(rows, 'wbs-012|emp-001');
    expect(person?.cells.map((cell) => cell.value)).toEqual([0.34, 0.33, 0.33]);
    expect(person?.total).toBe(1);
  });
});
