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

/**
 * Load per person per month, summed across every project.
 * Pass all allocations, not only those of the open project.
 */
export function capacityLoads(
  allocations: readonly CapacityAllocation[],
  weeklyHoursOf: (employeeId: string) => WeeklyHours | undefined,
): Map<string, PersonMonthLoad> {
  const groups = new Map<string, CapacityAllocation[]>();
  for (const allocation of allocations) {
    const key = loadKey(allocation.employeeId, allocation.month);
    const group = groups.get(key) ?? [];
    group.push(allocation);
    groups.set(key, group);
  }

  const loads = new Map<string, PersonMonthLoad>();
  for (const [key, group] of groups) {
    const [first] = group;
    if (!first) continue;
    const weeklyHours = weeklyHoursOf(first.employeeId);
    if (weeklyHours === undefined) continue;

    const capacityHours = personMonthHours(weeklyHours, first.month);
    const allocatedHours = group.reduce((sum, a) => sum + a.hours, 0);
    const overCapacity = allocatedHours > capacityHours + TOLERANCE_HOURS;

    loads.set(key, {
      employeeId: first.employeeId,
      month: first.month,
      allocatedHours,
      capacityHours,
      percent: (100 * allocatedHours) / capacityHours,
      overCapacity,
      causedBy: overCapacity ? latestEdited(group.filter((a) => a.hours > 0))?.id : undefined,
    });
  }
  return loads;
}

function latestEdited(group: readonly CapacityAllocation[]): CapacityAllocation | undefined {
  return group.reduce<CapacityAllocation | undefined>(
    (latest, a) => (latest === undefined || a.updatedAt > latest.updatedAt ? a : latest),
    undefined,
  );
}
