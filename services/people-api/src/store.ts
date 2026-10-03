import { mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Employee, RateRecord } from '@baseline/contracts';
import { JSONFilePreset } from 'lowdb/node';
import type { Low } from 'lowdb';

/** Everything People owns. Stored as one JSON file; small data, one writer. */
export interface PeopleData {
  employees: Employee[];
  rateRecords: RateRecord[];
}

export type PeopleStore = Low<PeopleData>;

/** Opens the data file, creating it from the seed fixture on first start. */
export async function openStore(dataFile: string, seedFile: string): Promise<PeopleStore> {
  // The seed is a trusted fixture shipped with the repo.
  const seed = JSON.parse(await readFile(seedFile, 'utf8')) as PeopleData;

  await mkdir(dirname(dataFile), { recursive: true });
  const store = await JSONFilePreset<PeopleData>(dataFile, {
    employees: seed.employees,
    rateRecords: seed.rateRecords,
  });
  await store.write();
  return store;
}
