import type { Employee } from '@baseline/contracts';
import { describe, expect, it } from 'vitest';
import { oversubscribedMonths } from './oversubscription';

// March 2026 has 22 working days: one person-month is 176 h at 40 h/week and 88 h at 20 h/week.
const fullTime: Employee = { id: 'emp-001', name: 'Adaeze Okafor', role: 'Tech Lead', weeklyHours: 40 };
const partTime: Employee = { id: 'emp-002', name: 'Part Timer', role: 'Designer', weeklyHours: 20 };

describe('oversubscribedMonths (R5)', () => {
  it('lists the months where a person is booked beyond one person-month', () => {
    const result = oversubscribedMonths([fullTime], [
      { employeeId: 'emp-001', month: '2026-04', hours: 200 },
      { employeeId: 'emp-001', month: '2026-03', hours: 177 },
    ]);
    expect(result.get('emp-001')).toEqual(['2026-03', '2026-04']);
  });

  it('treats exactly 100% as within capacity', () => {
    const result = oversubscribedMonths([fullTime], [{ employeeId: 'emp-001', month: '2026-03', hours: 176 }]);
    expect(result.has('emp-001')).toBe(false);
  });

  it('uses each person’s own weekly hours', () => {
    // 100 h is fine for a 40 h/week person but over capacity at 20 h/week.
    const usage = [
      { employeeId: 'emp-001', month: '2026-03', hours: 100 },
      { employeeId: 'emp-002', month: '2026-03', hours: 100 },
    ];
    const result = oversubscribedMonths([fullTime, partTime], usage);
    expect(result.has('emp-001')).toBe(false);
    expect(result.get('emp-002')).toEqual(['2026-03']);
  });
});
