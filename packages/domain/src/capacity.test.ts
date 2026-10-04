import { describe, expect, it } from 'vitest';
import { capacityLoads, isOverCapacity, loadKey, yearMonth, type CapacityAllocation, type WeeklyHours } from './index';

const march = yearMonth('2026-03'); // 22 working days → 176 h at 40 h/week
const weeklyHours = (id: string): WeeklyHours | undefined => (id === 'emp-001' ? 40 : undefined);

const alloc = (id: string, hours: number, updatedAt: string): CapacityAllocation => ({
  id,
  employeeId: 'emp-001',
  month: march,
  hours,
  updatedAt,
});

describe('capacityLoads', () => {
  it('sums every project and flags over capacity', () => {
    const loads = capacityLoads(
      [alloc('project-1', 100, '2026-10-01T10:00:00Z'), alloc('project-2', 80, '2026-10-01T09:00:00Z')],
      weeklyHours,
    );
    const load = loads.get(loadKey('emp-001', march));
    expect(load).toMatchObject({ allocatedHours: 180, capacityHours: 176, overCapacity: true });
  });

  it('names the most recently edited allocation as the cause', () => {
    const loads = capacityLoads(
      [alloc('older', 100, '2026-10-01T09:00:00Z'), alloc('newest', 80, '2026-10-02T09:00:00Z')],
      weeklyHours,
    );
    expect(loads.get(loadKey('emp-001', march))?.causedBy).toBe('newest');
  });

  it('treats exactly 100% as within capacity', () => {
    const loads = capacityLoads([alloc('a', 88, 't1'), alloc('b', 88, 't2')], weeklyHours);
    const load = loads.get(loadKey('emp-001', march));
    expect(load).toMatchObject({ percent: 100, overCapacity: false, causedBy: undefined });
  });
});

describe('isOverCapacity', () => {
  it('compares against that month’s person-month for the contract', () => {
    expect(isOverCapacity(176, 40, march)).toBe(false);
    expect(isOverCapacity(176.01, 40, march)).toBe(true);
    expect(isOverCapacity(100, 20, march)).toBe(true); // 20 h/week → 88 h in March
  });
});
