/**
 * The published contract between the People and Delivery teams.
 * Types only: what goes over HTTP and SSE. Neither side imports the other's code.
 * Dates are `YYYY-MM-DD`, months are `YYYY-MM`.
 */

// ---------- People (owner: People team, served by people-api) ----------

export type WeeklyHours = 40 | 32 | 20;

export interface Employee {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly weeklyHours: WeeklyHours;
}

export interface RateRecord {
  readonly id: string;
  readonly employeeId: string;
  /** Inclusive. The rate runs until the next record for the same employee starts. */
  readonly validFrom: string;
  readonly hourlyCost: number;
}

export interface RateInput {
  readonly validFrom: string;
  readonly hourlyCost: number;
}

// ---------- Delivery (owner: Delivery team, served by delivery-api) ----------

export interface Project {
  readonly id: string;
  readonly name: string;
  readonly startDate: string;
  readonly endDate: string;
}

export interface BreakdownItem {
  readonly id: string;
  readonly projectId: string;
  readonly parentId: string | null;
  readonly name: string;
}

export interface Allocation {
  readonly id: string;
  readonly breakdownItemId: string;
  readonly employeeId: string;
  readonly month: string;
  /** Canonical unit. Person-months, % and cost are display conversions of this. */
  readonly hours: number;
  /** ISO timestamp; the latest edit is named as the cause of an over-capacity month. */
  readonly updatedAt: string;
}

export interface AllocationInput {
  readonly breakdownItemId: string;
  readonly employeeId: string;
  readonly month: string;
  /** 0 removes the allocation. */
  readonly hours: number;
}

/** Hours booked per person per month across ALL projects. Read by People to flag oversubscription. */
export interface CapacityUsage {
  readonly employeeId: string;
  readonly month: string;
  readonly hours: number;
}

// ---------- Change events (SSE, `GET /events` on each API) ----------

export type PeopleEvent = { readonly type: 'rates.changed'; readonly employeeId: string };

export type DeliveryEvent =
  | { readonly type: 'allocations.changed'; readonly employeeIds: readonly string[] }
  | { readonly type: 'breakdown.changed'; readonly projectId: string };

/** Error body for 4xx responses. `message` is safe to show to the user. */
export interface ApiError {
  readonly message: string;
}
