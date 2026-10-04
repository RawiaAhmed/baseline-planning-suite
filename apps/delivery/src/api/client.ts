import type {
  Allocation,
  AllocationInput,
  ApiError,
  BreakdownItem,
  Employee,
  Project,
  RateRecord,
} from '@baseline/contracts';

/** Same paths standalone (dev proxy) and hosted (shell proxy / nginx). */
const DELIVERY_API = '/api/delivery';
const PEOPLE_API = '/api/people';

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

export interface NewItem {
  readonly projectId: string;
  readonly parentId: string | null;
  readonly name: string;
}

export interface ItemChange {
  readonly name?: string;
  readonly parentId?: string | null;
}

export const api = {
  // Delivery's own data
  projects: () => request<Project[]>(`${DELIVERY_API}/projects`),
  breakdownItems: (projectId: string) => request<BreakdownItem[]>(`${DELIVERY_API}/breakdown-items?projectId=${projectId}`),
  createItem: (item: NewItem) => request<BreakdownItem>(`${DELIVERY_API}/breakdown-items`, { method: 'POST', body: JSON.stringify(item) }),
  updateItem: (id: string, change: ItemChange) => request<BreakdownItem>(`${DELIVERY_API}/breakdown-items/${id}`, { method: 'PATCH', body: JSON.stringify(change) }),
  deleteItem: (id: string) => request<undefined>(`${DELIVERY_API}/breakdown-items/${id}`, { method: 'DELETE' }),
  /** Every project's allocations: capacity is only meaningful across all of them. */
  allocations: () => request<Allocation[]>(`${DELIVERY_API}/allocations`),
  setAllocation: (input: AllocationInput) => request<Allocation>(`${DELIVERY_API}/allocations`, { method: 'PUT', body: JSON.stringify(input) }),

  // People's published data
  employees: () => request<Employee[]>(`${PEOPLE_API}/employees`),
  rates: () => request<RateRecord[]>(`${PEOPLE_API}/rates`),
};

/** Query keys, so a change event can refresh exactly what it affects. */
export const keys = {
  projects: ['projects'],
  breakdownItems: (projectId: string) => ['breakdown-items', projectId],
  allBreakdownItems: ['breakdown-items'],
  allocations: ['allocations'],
  employees: ['employees'],
  rates: ['rates'],
} as const;
