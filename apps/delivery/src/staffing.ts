import type { Allocation, BreakdownItem, Employee, RateRecord } from '@baseline/contracts';
import {
  buildTree,
  capacityLoads,
  DECIMALS,
  fromHours,
  isoDate,
  loadKey,
  monthCost,
  roundTo,
  roundToTotal,
  yearMonth,
  type CellContext,
  type DisplayUnit,
  type PersonMonthLoad,
  type YearMonth,
} from '@baseline/domain';
import { groupBy, keyBy, sum } from 'es-toolkit';

/**
 * The staffing grid as plain data, built without React so it can be tested
 * on its own. Components only render what this returns.
 */

export interface GridInput {
  readonly items: readonly BreakdownItem[];
  /** All projects' allocations: capacity is counted across every project. */
  readonly allocations: readonly Allocation[];
  readonly employees: readonly Employee[];
  readonly rates: readonly RateRecord[];
  readonly months: readonly YearMonth[];
  readonly unit: DisplayUnit;
  /** Display currency units per EUR; only applies to cost. */
  readonly perEuro: number;
  /** People added to a leaf in the UI who have no effort yet: leafId → employeeIds. */
  readonly addedPeople?: ReadonlyMap<string, readonly string[]>;
}

export interface GridCell {
  readonly month: YearMonth;
  /** Rounded for display; the row's cells add up to its total exactly (R3). */
  readonly value: number;
  /** Some working days fall before the person's first rate, so they cost zero (R1). */
  readonly unpriced: boolean;
  /** Set when this cell is the latest edit that pushed its person-month over capacity (R5). */
  readonly overCapacity: PersonMonthLoad | undefined;
}

export type GridRow =
  | {
      readonly kind: 'item';
      readonly key: string;
      readonly item: BreakdownItem;
      readonly depth: number;
      readonly isLeaf: boolean;
      readonly cells: readonly GridCell[];
      readonly total: number;
    }
  | {
      readonly kind: 'person';
      readonly key: string;
      readonly item: BreakdownItem;
      readonly employee: Employee;
      readonly depth: number;
      readonly cells: readonly GridCell[];
      readonly total: number;
    };

/** Exact (unrounded) values of one row, before display rounding. */
interface ExactRow {
  readonly values: readonly number[];
  readonly unpriced: readonly boolean[];
  readonly overCapacity: readonly (PersonMonthLoad | undefined)[];
}

export function buildGrid(input: GridInput): GridRow[] {
  const { items, months, unit } = input;
  const tree = buildTree(items);
  const employeesById = keyBy(input.employees, (employee) => employee.id);
  const ratesByEmployee = groupBy(input.rates, (rate) => rate.employeeId);
  const allocationsByItem = groupBy(input.allocations, (allocation) => allocation.breakdownItemId);
  const loads = capacityLoads(
    input.allocations.map((allocation) => ({ ...allocation, month: yearMonth(allocation.month) })),
    (employeeId) => employeesById[employeeId]?.weeklyHours,
  );

  /** One person on one leaf, every month of the grid. */
  const personRow = (leafId: string, employee: Employee): ExactRow => {
    const allocations = (allocationsByItem[leafId] ?? []).filter((a) => a.employeeId === employee.id);
    const cells = months.map((month) => {
      const allocation = allocations.find((a) => a.month === month);
      const hours = allocation?.hours ?? 0;
      const context: CellContext = {
        month,
        weeklyHours: employee.weeklyHours,
        rates: (ratesByEmployee[employee.id] ?? []).map((rate) => ({ ...rate, validFrom: isoDate(rate.validFrom) })),
      };
      const load = loads.get(loadKey(employee.id, month));
      return {
        value: fromHours(hours, unit, context) * (unit === 'cost' ? input.perEuro : 1),
        unpriced: hours > 0 && monthCost(hours, month, context.rates).hasUnpricedDays,
        overCapacity: allocation && load?.causedBy === allocation.id ? load : undefined,
      };
    });
    return {
      values: cells.map((cell) => cell.value),
      unpriced: cells.map((cell) => cell.unpriced),
      overCapacity: cells.map((cell) => cell.overCapacity),
    };
  };

  const peopleOn = (leafId: string): Employee[] => {
    const withEffort = (allocationsByItem[leafId] ?? []).map((a) => a.employeeId);
    const ids = [...new Set([...withEffort, ...(input.addedPeople?.get(leafId) ?? [])])];
    return ids.flatMap((id) => employeesById[id] ?? []).sort((a, b) => a.name.localeCompare(b.name));
  };

  /** Rows for `item` and everything under it, plus the item's exact values so its parent can sum them (R4). */
  const visit = (item: BreakdownItem): { rows: GridRow[]; exact: ExactRow } => {
    const depth = tree.depthOf(item.id);
    const isLeaf = tree.isLeaf(item.id);
    let childRows: GridRow[];
    let childExacts: ExactRow[];

    if (isLeaf) {
      const people = peopleOn(item.id).map((employee) => ({ employee, exact: personRow(item.id, employee) }));
      childRows = people.map(({ employee, exact }) => ({
        kind: 'person',
        key: `${item.id}|${employee.id}`,
        item,
        employee,
        depth: depth + 1,
        ...rounded(exact, months, unit),
      }));
      childExacts = people.map((person) => person.exact);
    } else {
      const children = tree.childrenOf(item.id).map(visit);
      childRows = children.flatMap((child) => child.rows);
      childExacts = children.map((child) => child.exact);
    }

    const exact = sumRows(childExacts, months.length);
    const itemRow: GridRow = { kind: 'item', key: item.id, item, depth, isLeaf, ...rounded(exact, months, unit) };
    return { rows: [itemRow, ...childRows], exact };
  };

  return tree.roots.flatMap((root) => visit(root).rows);
}

/** Derived rows are the sum of their children; markers are not carried up. */
function sumRows(children: readonly ExactRow[], monthCount: number): ExactRow {
  const values = Array.from({ length: monthCount }, (_, index) => sum(children.map((child) => child.values[index] ?? 0)));
  return { values, unpriced: values.map(() => false), overCapacity: values.map(() => undefined) };
}

/** Rounds a row for display so its cells add up to its rounded total (R3). */
function rounded(exact: ExactRow, months: readonly YearMonth[], unit: DisplayUnit): { cells: GridCell[]; total: number } {
  const decimals = DECIMALS[unit];
  const values = roundToTotal(exact.values, decimals);
  return {
    total: roundTo(sum(exact.values), decimals),
    cells: months.map((month, index) => ({
      month,
      value: values[index] ?? 0,
      unpriced: exact.unpriced[index] ?? false,
      overCapacity: exact.overCapacity[index],
    })),
  };
}
