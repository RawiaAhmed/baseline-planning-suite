import { Low, Memory } from 'lowdb';
import { describe, expect, it } from 'vitest';
import { buildServer } from './server';
import type { DeliveryData } from './store';

function testServer() {
  const store = new Low<DeliveryData>(new Memory(), {
    projects: [{ id: 'prj-1', name: 'Ledger', startDate: '2026-03-01', endDate: '2027-02-28' }],
    breakdownItems: [
      { id: 'root', projectId: 'prj-1', parentId: null, name: 'Ledger migration' },
      { id: 'leaf', projectId: 'prj-1', parentId: 'root', name: 'Discovery' },
    ],
    allocations: [
      { id: 'alloc-1', breakdownItemId: 'leaf', employeeId: 'emp-001', month: '2026-03', hours: 88, updatedAt: '2026-01-01T00:00:00Z' },
    ],
  });
  return { app: buildServer(store), store };
}

describe('delivery-api', () => {
  it('R4: moves a leaf’s allocations onto a new child instead of losing them', async () => {
    const { app, store } = testServer();

    const response = await app.inject({
      method: 'POST',
      url: '/breakdown-items',
      payload: { projectId: 'prj-1', parentId: 'leaf', name: 'Design' },
    });
    const child = response.json<{ id: string }>();

    expect(response.statusCode).toBe(201);
    expect(store.data.allocations).toEqual([expect.objectContaining({ breakdownItemId: child.id, hours: 88 })]);
  });

  it('refuses effort on a parent row', async () => {
    const response = await testServer().app.inject({
      method: 'PUT',
      url: '/allocations',
      payload: { breakdownItemId: 'root', employeeId: 'emp-001', month: '2026-03', hours: 10 },
    });
    expect(response.statusCode).toBe(409);
  });

  it('sums capacity usage per person-month across projects', async () => {
    const { app } = testServer();
    await app.inject({
      method: 'PUT',
      url: '/allocations',
      payload: { breakdownItemId: 'leaf', employeeId: 'emp-001', month: '2026-04', hours: 20 },
    });
    expect((await app.inject({ url: '/capacity-usage' })).json()).toEqual([
      { employeeId: 'emp-001', month: '2026-03', hours: 88 },
      { employeeId: 'emp-001', month: '2026-04', hours: 20 },
    ]);
  });
});
