import { createChannel, createSession } from 'better-sse';
import type { FastifyInstance } from 'fastify';

/**
 * Server-Sent Events: every client that opens `GET /events` receives each
 * change this service broadcasts, so open views refresh without a reload.
 */
export function registerEvents<Event>(app: FastifyInstance): (event: Event) => void {
  const channel = createChannel();

  app.get('/events', async (request, reply) => {
    // better-sse writes the response itself, so Fastify must not send one.
    reply.hijack();
    const session = await createSession(request.raw, reply.raw, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
    channel.register(session);
  });

  return (event) => channel.broadcast(event);
}
