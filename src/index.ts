import fastify from 'fastify';
import proxy from '@fastify/http-proxy';
import replyFrom from '@fastify/reply-from';
import cors from '@fastify/cors';
import { ENV, logger } from './util';
import { setupShutdownHandler } from './shutdown';

const STACKS_NODE_RPC_PREFIX = '/v2';

async function init() {
  setupShutdownHandler();

  const server = fastify({ logger });

  await server.register(cors);

  /*
  server.addContentTypeParser(
    'application/octet-stream',
    (req, payload, done) => {
      done(null, payload);
    }
  );

  server.addContentTypeParser('application/json', (req, payload, done) => {
    done(null, payload);
  });

  server.addContentTypeParser('*', (req, payload, done) => {
    done(null, payload);
  });

  await server.register(proxy, {
    upstream: `http://${ENV.STACKS_CORE_PROXY_HOST}:${ENV.STACKS_CORE_PROXY_PORT}/v2/transactions`,
    prefix: '/v2/transactions',
    proxyPayloads: false,
    preHandler: async (request, reply) => {
      const body = request.body;
    },
    replyOptions: {
      onResponse(request, reply, res) {
        reply.send(res);
      },
    },
  });
  */

  const upstream = `http://${ENV.STACKS_CORE_PROXY_HOST}:${ENV.STACKS_CORE_PROXY_PORT}${STACKS_NODE_RPC_PREFIX}`;
  logger.info(`Proxying to upstream: ${upstream}`);

  await server.register(proxy, {
    upstream: upstream,
    prefix: STACKS_NODE_RPC_PREFIX,
  });

  await server.listen({
    host: ENV.RPC_PROXY_HOST,
    port: ENV.RPC_PROXY_PORT,
  });
}

init().catch((err) => {
  logger.error(err);
  process.exit(1);
});
