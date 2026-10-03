import { Low, Memory } from 'lowdb';
import { describe, expect, it } from 'vitest';
import { buildServer } from './server';
import type { PeopleData } from './store';

function testServer() {
  const store = new Low<PeopleData>(new Memory(), {
    employees: [{ id: 'emp-001', name: 'Adaeze Okafor', role: 'Tech Lead', weeklyHours: 40 }],
    rateRecords: [{ id: 'rate-001', employeeId: 'emp-001', validFrom: '2025-01-01', hourlyCost: 80 }],
  });
  return buildServer(store);
}

describe('people-api', () => {
  it('adds, corrects and removes a rate, including retroactively', async () => {
    const app = testServer();

    const added = await app.inject({
      method: 'POST',
      url: '/employees/emp-001/rates',
      payload: { validFrom: '2024-06-01', hourlyCost: 70 },
    });
    expect(added.statusCode).toBe(201);
    const rateId = added.json<{ id: string }>().id;

    const corrected = await app.inject({ method: 'PUT', url: `/rates/${rateId}`, payload: { validFrom: '2024-06-01', hourlyCost: 72 } });
    expect(corrected.json()).toMatchObject({ hourlyCost: 72 });

    expect((await app.inject({ method: 'DELETE', url: `/rates/${rateId}` })).statusCode).toBe(204);
    expect((await app.inject({ url: '/rates?employeeId=emp-001' })).json()).toHaveLength(1);
  });

  it('refuses two rates starting on the same day', async () => {
    const response = await testServer().inject({
      method: 'POST',
      url: '/employees/emp-001/rates',
      payload: { validFrom: '2025-01-01', hourlyCost: 90 },
    });
    expect(response.statusCode).toBe(409);
  });

  it('rejects invalid input with a readable message', async () => {
    const response = await testServer().inject({
      method: 'POST',
      url: '/employees/emp-001/rates',
      payload: { validFrom: '2025-13-01', hourlyCost: -5 },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty('message');
  });
});
