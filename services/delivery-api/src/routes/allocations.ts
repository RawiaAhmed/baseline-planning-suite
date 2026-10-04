import { randomUUID } from 'node:crypto';
import type { Allocation, CapacityUsage, DeliveryEvent } from '@baseline/contracts';
import { buildTree } from '@baseline/domain';
import { groupBy, sumBy } from 'es-toolkit';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DeliveryStore } from '../store';

const allocationInput = z.object({
  breakdownItemId: z.string().min(1),
  employeeId: z.string().min(1),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM'),
  hours: z.number().min(0),
});

export function allocationRoutes(app: FastifyInstance, store: DeliveryStore, publish: (event: DeliveryEvent) => void): void {
  app.get<{ Querystring: { projectId?: string } }>('/allocations', async (request) => {
    const { projectId } = request.query;
    if (!projectId) return store.data.allocations;

    const itemIds = new Set(store.data.breakdownItems.filter((i) => i.projectId === projectId).map((i) => i.id));
    return store.data.allocations.filter((allocation) => itemIds.has(allocation.breakdownItemId));
  });

  /** Sets one staffing cell. Hours 0 clears it. Only leaves hold effort; parents are derived. */
  app.put('/allocations', async (request, reply) => {
    const input = allocationInput.parse(request.body);

    const item = store.data.breakdownItems.find((i) => i.id === input.breakdownItemId);
    if (!item) return reply.code(404).send({ message: 'Item not found' });
    const projectItems = store.data.breakdownItems.filter((i) => i.projectId === item.projectId);
    if (!buildTree(projectItems).isLeaf(item.id)) {
      return reply.code(409).send({ message: 'Only leaf items take effort; parents are derived from their children' });
    }

    const isSameCell = (a: Allocation) =>
      a.breakdownItemId === input.breakdownItemId && a.employeeId === input.employeeId && a.month === input.month;
    const existing = store.data.allocations.find(isSameCell);
    const saved: Allocation = { id: existing?.id ?? `alloc-${randomUUID()}`, ...input, updatedAt: new Date().toISOString() };

    await store.update((data) => {
      data.allocations = data.allocations.filter((a) => !isSameCell(a));
      if (saved.hours > 0) data.allocations.push(saved);
    });

    publish({ type: 'allocations.changed', employeeIds: [input.employeeId] });
    return saved;
  });

  /** Published for People: hours per person per month across every project. */
  app.get('/capacity-usage', async (): Promise<CapacityUsage[]> => {
    const byPersonMonth = groupBy(store.data.allocations, (a) => `${a.employeeId}|${a.month}`);
    return Object.values(byPersonMonth).map((group) => {
      // groupBy never yields an empty group, so the first entry always exists.
      const [{ employeeId, month }] = group as [Allocation, ...Allocation[]];
      return { employeeId, month, hours: sumBy(group, (a) => a.hours) };
    });
  });
}
