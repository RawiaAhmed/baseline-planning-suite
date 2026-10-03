import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Allocation, BreakdownItem, Employee, Project } from '@baseline/contracts';
import { personMonthHours, yearMonth } from '@baseline/domain';
import { keyBy } from 'es-toolkit';
import { JSONFilePreset } from 'lowdb/node';
import type { Low } from 'lowdb';

/** Everything Delivery owns. Stored as one JSON file; small data, one writer. */
export interface DeliveryData {
  projects: Project[];
  breakdownItems: BreakdownItem[];
  allocations: Allocation[];
}

export type DeliveryStore = Low<DeliveryData>;

/** Shape of the seed file; allocation `amount` is in person-months. */
interface Seed {
  employees: Employee[];
  projects: Project[];
  breakdownItems: BreakdownItem[];
  allocations: { id: string; breakdownItemId: string; employeeId: string; month: string; amount: number }[];
}

/** Opens the data file, creating it from the seed fixture on first start. */
export async function openStore(dataFile: string, seedFile: string): Promise<DeliveryStore> {
  // The seed is a trusted fixture shipped with the repo.
  const seed = JSON.parse(await readFile(seedFile, 'utf8')) as Seed;

  await mkdir(dirname(dataFile), { recursive: true });
  const store = await JSONFilePreset<DeliveryData>(dataFile, {
    projects: seed.projects,
    breakdownItems: seed.breakdownItems,
    allocations: allocationsInHours(seed),
  });
  await store.write();
  return store;
}

/**
 * The seed stores person-months; Delivery stores hours. Converting needs each
 * person's weekly hours, read once from the fixture. At runtime Delivery
 * never reads People's data from here.
 */
function allocationsInHours(seed: Seed): Allocation[] {
  const employees = keyBy(seed.employees, (employee) => employee.id);
  const importedAt = new Date(0).toISOString();

  return seed.allocations.map(({ amount, ...allocation }) => {
    const weeklyHours = employees[allocation.employeeId]?.weeklyHours ?? 40;
    return {
      ...allocation,
      hours: amount * personMonthHours(weeklyHours, yearMonth(allocation.month)),
      updatedAt: importedAt,
    };
  });
}
