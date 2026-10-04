import { groupBy, maxBy, sumBy } from 'es-toolkit';
import type { YearMonth } from './calendar';
import { personMonthHours, type WeeklyHours } from './units';

/** The part of an allocation that capacity cares about. Hours are the stored unit. */
export interface CapacityAllocation {
  readonly id: string;
  readonly employeeId: string;
  readonly month: YearMonth;
  readonly hours: number;
  /** ISO timestamp of the last edit; decides which allocation is named as the cause. */
  readonly updatedAt: string;
}

export interface PersonMonthLoad {
  readonly employeeId: string;
  readonly month: YearMonth;
  readonly allocatedHours: number;
  readonly capacityHours: number;
  /** Allocated ÷ capacity × 100. */
  readonly percent: number;
  readonly overCapacity: boolean;
  /** Most recently edited allocation in an over-capacity person-month; undefined otherwise. */
  readonly causedBy: string | undefined;
}

/** Floating-point allowance only; 100.0000001% is not over capacity. */
const TOLERANCE_HOURS = 1e-6;

export const loadKey = (employeeId: string, month: YearMonth): string => `${employeeId}|${month}`;

/** True when `allocatedHours` in `month` exceed one person-month for this contract. */
export function isOverCapacity(allocatedHours: number, weeklyHours: WeeklyHours, month: YearMonth): boolean {
  return allocatedHours > personMonthHours(weeklyHours, month) + TOLERANCE_HOURS;
}

/**
 * Load per person per month, summed across every project.
 * Pass all allocations, not only those of the open project.
 */
export function capacityLoads(
  allocations: readonly CapacityAllocation[],
  weeklyHoursOf: (employeeId: string) => WeeklyHours | undefined,
): Map<string, PersonMonthLoad> {
  const loads = new Map<string, PersonMonthLoad>();
  const groups = groupBy(allocations, (allocation) => loadKey(allocation.employeeId, allocation.month));

  for (const [key, group] of Object.entries(groups)) {
    // groupBy never yields an empty group, so the first entry always exists.
    const [{ employeeId, month }] = group as [CapacityAllocation, ...CapacityAllocation[]];
    const weeklyHours = weeklyHoursOf(employeeId);
    if (weeklyHours === undefined) continue;

    const capacityHours = personMonthHours(weeklyHours, month);
    const allocatedHours = sumBy(group, (allocation) => allocation.hours);
    const overCapacity = isOverCapacity(allocatedHours, weeklyHours, month);
    const latestEdit = maxBy(
      group.filter((allocation) => allocation.hours > 0),
      (allocation) => Date.parse(allocation.updatedAt),
    );

    loads.set(key, {
      employeeId,
      month,
      allocatedHours,
      capacityHours,
      percent: (100 * allocatedHours) / capacityHours,
      overCapacity,
      causedBy: overCapacity ? latestEdit?.id : undefined,
    });
  }

  return loads;
}
