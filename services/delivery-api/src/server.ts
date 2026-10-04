import cors from '@fastify/cors';
import type { DeliveryEvent } from '@baseline/contracts';
import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { allocationRoutes } from './routes/allocations';
import { breakdownRoutes } from './routes/breakdown';
import { registerEvents } from './events';
import type { DeliveryStore } from './store';

export function buildServer(store: DeliveryStore): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });
  app.register(cors, { methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] });
  const publish = registerEvents<DeliveryEvent>(app);

  breakdownRoutes(app, store, publish);
  allocationRoutes(app, store, publish);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ message: z.prettifyError(error) });
    }
    return reply.send(error);
  });

  return app;
}
