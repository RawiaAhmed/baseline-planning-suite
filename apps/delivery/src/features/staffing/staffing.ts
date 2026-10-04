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
  /** Exact while the grid is built; rounded for display at the end, so a row's cells add up to its total (R3). */
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

  /** One person on one leaf in one month. */
  const exactCell = (leafId: string, employee: Employee, month: YearMonth): GridCell => {
    const allocation = allocationsByItem[leafId]?.find((a) => a.employeeId === employee.id && a.month === month);
    const hours = allocation?.hours ?? 0;
    const context: CellContext = {
      month,
      weeklyHours: employee.weeklyHours,
      rates: (ratesByEmployee[employee.id] ?? []).map((rate) => ({ ...rate, validFrom: isoDate(rate.validFrom) })),
    };
    const load = loads.get(loadKey(employee.id, month));
    return {
      month,
      value: fromHours(hours, unit, context) * (unit === 'cost' ? input.perEuro : 1),
      unpriced: hours > 0 && monthCost(hours, month, context.rates).hasUnpricedDays,
      overCapacity: allocation && load?.causedBy === allocation.id ? load : undefined,
    };
  };

  /** People with effort on the leaf, plus anyone added in the UI, sorted by name. */
  const peopleOn = (leafId: string): Employee[] => {
    const withEffort = (allocationsByItem[leafId] ?? []).map((a) => a.employeeId);
    const ids = [...new Set([...withEffort, ...(input.addedPeople?.get(leafId) ?? [])])];
    return ids.flatMap((id) => employeesById[id] ?? []).sort((a, b) => a.name.localeCompare(b.name));
  };

  /** Rows for an item and everything under it. Also returns the item's exact cells, so its parent can add them up (R4). */
  const rowsFor = (item: BreakdownItem): { rows: GridRow[]; exact: GridCell[] } => {
    const depth = tree.depthOf(item.id);
    const isLeaf = tree.isLeaf(item.id);
    const childRows: GridRow[] = [];
    const childExacts: GridCell[][] = [];

    if (isLeaf) {
      for (const employee of peopleOn(item.id)) {
        const exact = months.map((month) => exactCell(item.id, employee, month));
        const key = `${item.id}|${employee.id}`;
        childRows.push({ kind: 'person', key, item, employee, depth: depth + 1, ...rounded(exact, unit) });
        childExacts.push(exact);
      }
    } else {
      for (const child of tree.childrenOf(item.id)) {
        const result = rowsFor(child);
        childRows.push(...result.rows);
        childExacts.push(result.exact);
      }
    }

    const exact = sumCells(childExacts, months);
    const itemRow: GridRow = { kind: 'item', key: item.id, item, depth, isLeaf, ...rounded(exact, unit) };
    return { rows: [itemRow, ...childRows], exact };
  };

  return tree.roots.flatMap((root) => rowsFor(root).rows);
}

/** A derived row is the month-by-month sum of its children. Markers stay on the person rows. */
function sumCells(children: readonly GridCell[][], months: readonly YearMonth[]): GridCell[] {
  return months.map((month, index) => ({
    month,
    value: sum(children.map((cells) => cells[index]?.value ?? 0)),
    unpriced: false,
    overCapacity: undefined,
  }));
}

/** Rounds a row for display so its cells add up to its rounded total (R3). */
function rounded(exact: readonly GridCell[], unit: DisplayUnit): { cells: GridCell[]; total: number } {
  const decimals = DECIMALS[unit];
  const exactValues = exact.map((cell) => cell.value);
  const roundedValues = roundToTotal(exactValues, decimals);
  return {
    total: roundTo(sum(exactValues), decimals),
    cells: exact.map((cell, index) => ({ ...cell, value: roundedValues[index] ?? 0 })),
  };
}
