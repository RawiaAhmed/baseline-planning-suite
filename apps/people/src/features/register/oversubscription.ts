import type { CapacityUsage, Employee } from '@baseline/contracts';
import { isOverCapacity, yearMonth } from '@baseline/domain';
import { groupBy, keyBy } from 'es-toolkit';

/** Months in which each person is booked beyond one person-month, across all projects. */
export function oversubscribedMonths(employees: readonly Employee[], usage: readonly CapacityUsage[]): Map<string, string[]> {
  const employeesById = keyBy(employees, (employee) => employee.id);

  const overMonths = usage.filter((entry) => {
    const employee = employeesById[entry.employeeId];
    return employee !== undefined && isOverCapacity(entry.hours, employee.weeklyHours, yearMonth(entry.month));
  });

  const byEmployee = groupBy(overMonths, (entry) => entry.employeeId);
  return new Map(Object.entries(byEmployee).map(([employeeId, entries]) => [employeeId, entries.map((e) => e.month).sort()]));
}
