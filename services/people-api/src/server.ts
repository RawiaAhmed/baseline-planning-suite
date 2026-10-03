import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import type { PeopleEvent, RateRecord } from '@baseline/contracts';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { registerEvents } from './events';
import type { PeopleStore } from './store';

const rateInput = z.object({
  validFrom: z.iso.date(),
  hourlyCost: z.number().positive(),
});

export function buildServer(store: PeopleStore): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.register(cors, { methods: ['GET', 'POST', 'PUT', 'DELETE'] });
  const publish = registerEvents<PeopleEvent>(app);

  const findEmployee = (id: string) => store.data.employees.find((employee) => employee.id === id);
  const findRate = (id: string) => store.data.rateRecords.find((rate) => rate.id === id);

  /** Two records for one person may not start on the same day; that would make the rate ambiguous. */
  const startsOnSameDay = (employeeId: string, validFrom: string, ignoreId?: string) =>
    store.data.rateRecords.some(
      (rate) => rate.employeeId === employeeId && rate.validFrom === validFrom && rate.id !== ignoreId,
    );

  app.get('/employees', async () => store.data.employees);

  app.get<{ Querystring: { employeeId?: string } }>('/rates', async (request) => {
    const { employeeId } = request.query;
    return employeeId ? store.data.rateRecords.filter((rate) => rate.employeeId === employeeId) : store.data.rateRecords;
  });

  app.post<{ Params: { employeeId: string } }>('/employees/:employeeId/rates', async (request, reply) => {
    const { employeeId } = request.params;
    if (!findEmployee(employeeId)) return reply.code(404).send({ message: 'Employee not found' });

    const input = rateInput.parse(request.body);
    if (startsOnSameDay(employeeId, input.validFrom)) {
      return reply.code(409).send({ message: `A rate already starts on ${input.validFrom}` });
    }

    const rate: RateRecord = { id: `rate-${randomUUID()}`, employeeId, ...input };
    await store.update((data) => data.rateRecords.push(rate));
    publish({ type: 'rates.changed', employeeId });
    return reply.code(201).send(rate);
  });

  app.put<{ Params: { rateId: string } }>('/rates/:rateId', async (request, reply) => {
    const existing = findRate(request.params.rateId);
    if (!existing) return reply.code(404).send({ message: 'Rate not found' });

    const input = rateInput.parse(request.body);
    if (startsOnSameDay(existing.employeeId, input.validFrom, existing.id)) {
      return reply.code(409).send({ message: `A rate already starts on ${input.validFrom}` });
    }

    const updated: RateRecord = { ...existing, ...input };
    await store.update((data) => {
      data.rateRecords = data.rateRecords.map((rate) => (rate.id === existing.id ? updated : rate));
    });
    publish({ type: 'rates.changed', employeeId: existing.employeeId });
    return updated;
  });

  app.delete<{ Params: { rateId: string } }>('/rates/:rateId', async (request, reply) => {
    const existing = findRate(request.params.rateId);
    if (!existing) return reply.code(404).send({ message: 'Rate not found' });

    await store.update((data) => {
      data.rateRecords = data.rateRecords.filter((rate) => rate.id !== existing.id);
    });
    publish({ type: 'rates.changed', employeeId: existing.employeeId });
    return reply.code(204).send();
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ message: z.prettifyError(error) });
    }
    return reply.send(error);
  });

  return app;
}
