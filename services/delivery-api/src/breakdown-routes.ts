import { randomUUID } from 'node:crypto';
import type { BreakdownItem, DeliveryEvent } from '@baseline/contracts';
import { MAX_DEPTH, buildTree, moveProblem } from '@baseline/domain';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DeliveryStore } from './store';

const createInput = z.object({
  projectId: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  name: z.string().trim().min(1),
});

const updateInput = z.object({
  name: z.string().trim().min(1).optional(),
  parentId: z.string().min(1).nullable().optional(),
});

const MOVE_MESSAGES = {
  'into-itself': 'An item cannot be moved under itself or one of its children',
  'too-deep': `The breakdown is limited to ${MAX_DEPTH} levels`,
} as const;

export function breakdownRoutes(app: FastifyInstance, store: DeliveryStore, publish: (event: DeliveryEvent) => void): void {
  const itemsOf = (projectId: string) => store.data.breakdownItems.filter((item) => item.projectId === projectId);
  const findItem = (id: string) => store.data.breakdownItems.find((item) => item.id === id);
  const hasAllocations = (itemId: string) => store.data.allocations.some((a) => a.breakdownItemId === itemId);

  app.get('/projects', async () => store.data.projects);

  app.get<{ Querystring: { projectId: string } }>('/breakdown-items', async (request) => itemsOf(request.query.projectId));

  /**
   * R4: when a child is added under a leaf that already has allocations,
   * those allocations move onto the new child, so no effort is lost.
   */
  app.post('/breakdown-items', async (request, reply) => {
    const input = createInput.parse(request.body);
    if (!store.data.projects.some((project) => project.id === input.projectId)) {
      return reply.code(404).send({ message: 'Project not found' });
    }

    if (input.parentId !== null) {
      const parent = findItem(input.parentId);
      if (parent?.projectId !== input.projectId) return reply.code(404).send({ message: 'Parent not found' });
      if (buildTree(itemsOf(input.projectId)).depthOf(parent.id) >= MAX_DEPTH) {
        return reply.code(409).send({ message: MOVE_MESSAGES['too-deep'] });
      }
    }

    const item: BreakdownItem = { id: `wbs-${randomUUID()}`, ...input };
    const movedFrom = input.parentId;
    await store.update((data) => {
      data.breakdownItems.push(item);
      data.allocations = data.allocations.map((allocation) =>
        allocation.breakdownItemId === movedFrom ? { ...allocation, breakdownItemId: item.id } : allocation,
      );
    });

    publish({ type: 'breakdown.changed', projectId: item.projectId });
    return reply.code(201).send(item);
  });

  app.patch<{ Params: { itemId: string } }>('/breakdown-items/:itemId', async (request, reply) => {
    const existing = findItem(request.params.itemId);
    if (!existing) return reply.code(404).send({ message: 'Item not found' });

    const input = updateInput.parse(request.body);
    const newParentId = input.parentId === undefined ? existing.parentId : input.parentId;

    if (newParentId !== existing.parentId && newParentId !== null) {
      const parent = findItem(newParentId);
      if (parent?.projectId !== existing.projectId) return reply.code(404).send({ message: 'Parent not found' });

      const problem = moveProblem(buildTree(itemsOf(existing.projectId)), existing.id, newParentId);
      if (problem) return reply.code(409).send({ message: MOVE_MESSAGES[problem] });

      // Moving under a leaf would turn its own allocations into a parent's, which R4 forbids silently.
      if (hasAllocations(newParentId)) {
        return reply.code(409).send({ message: `"${parent.name}" has its own allocations; it cannot become a parent by a move` });
      }
    }

    const updated: BreakdownItem = { ...existing, name: input.name ?? existing.name, parentId: newParentId };
    await store.update((data) => {
      data.breakdownItems = data.breakdownItems.map((item) => (item.id === existing.id ? updated : item));
    });

    publish({ type: 'breakdown.changed', projectId: existing.projectId });
    return updated;
  });

  /** Deletes the item, everything under it and all their allocations. */
  app.delete<{ Params: { itemId: string } }>('/breakdown-items/:itemId', async (request, reply) => {
    const existing = findItem(request.params.itemId);
    if (!existing) return reply.code(404).send({ message: 'Item not found' });

    const descendants = buildTree(itemsOf(existing.projectId)).descendantsOf(existing.id);
    const removedIds = new Set([existing.id, ...descendants.map((item) => item.id)]);
    const removedAllocations = store.data.allocations.filter((a) => removedIds.has(a.breakdownItemId));

    await store.update((data) => {
      data.breakdownItems = data.breakdownItems.filter((item) => !removedIds.has(item.id));
      data.allocations = data.allocations.filter((a) => !removedIds.has(a.breakdownItemId));
    });

    publish({ type: 'breakdown.changed', projectId: existing.projectId });
    if (removedAllocations.length > 0) {
      publish({ type: 'allocations.changed', employeeIds: [...new Set(removedAllocations.map((a) => a.employeeId))] });
    }
    return reply.code(204).send();
  });
}
