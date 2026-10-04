import type { ApiError, CapacityUsage, Employee, RateInput, RateRecord } from '@baseline/contracts';

/** Same paths standalone (dev proxy) and hosted (shell proxy / nginx). */
const PEOPLE_API = '/api/people';
const DELIVERY_API = '/api/delivery';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : {},
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({ message: response.statusText }))) as ApiError;
    throw new Error(body.message);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  employees: () => request<Employee[]>(`${PEOPLE_API}/employees`),
  rates: () => request<RateRecord[]>(`${PEOPLE_API}/rates`),
  addRate: (employeeId: string, input: RateInput) =>
    request<RateRecord>(`${PEOPLE_API}/employees/${employeeId}/rates`, { method: 'POST', body: JSON.stringify(input) }),
  updateRate: (rateId: string, input: RateInput) =>
    request<RateRecord>(`${PEOPLE_API}/rates/${rateId}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteRate: (rateId: string) => request<undefined>(`${PEOPLE_API}/rates/${rateId}`, { method: 'DELETE' }),

  /** Delivery's published contract: booked hours per person-month across all projects. */
  capacityUsage: () => request<CapacityUsage[]>(`${DELIVERY_API}/capacity-usage`),
};

/** Query keys, so a change event can refresh exactly what it affects. */
export const keys = {
  employees: ['employees'],
  rates: ['rates'],
  capacityUsage: ['capacity-usage'],
} as const;
