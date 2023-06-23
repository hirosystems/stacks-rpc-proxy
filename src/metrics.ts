import fastify from 'fastify';
import { IFastifyMetrics } from 'fastify-metrics';
import { ENV, logger } from './util';

export async function startPromServer(metrics: IFastifyMetrics) {
  const server = fastify({
    trustProxy: true,
    logger,
  });

  server.route({
    url: '/metrics',
    method: 'GET',
    logLevel: 'info',
    handler: async (_, reply) => {
      await reply
        .type('text/plain')
        .send(await metrics.client.register.metrics());
    },
  });

  await server.listen({
    host: ENV.PROMETHEUS_HOST,
    port: ENV.PROMETHEUS_PORT,
  });

  return server;
}
