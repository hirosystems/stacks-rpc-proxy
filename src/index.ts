import { PassThrough, Readable, Transform } from 'node:stream';
import fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import proxy from '@fastify/http-proxy';
import replyFrom from '@fastify/reply-from';
import cors from '@fastify/cors';
import { ENV, logger } from './util';
import { setupShutdownHandler } from './shutdown';
import { isTxMulticastEnabled } from './tx-post-multicast';

const STACKS_NODE_RPC_PREFIX = '/v2';

// Access-Control-Request-Method
const ALLOW_REQUEST_METHODS = ['GET', 'PUT', 'POST', 'HEAD', 'OPTIONS'];

// Access-Control-Request-Headers
const ALLOW_REQUEST_HEADERS = [
  // NOTE: unclear if routing layer will handle these for us, so for now update this list as needed
  'Content-Type',
  'Authorization',
  'X-Api-Key',
  'X-Hiro-Product',
  'X-Hiro-Version',
];

// Access-Control-Allow-Headers
const ALLOW_RESPONSE_HEADERS = [
  // Allow browser JS to read these response headers
  'Content-Type',
  'X-Api-Version',
];

async function postTxMulticast(request: any, reply: any, body: any) {
  await Promise.resolve();
}

function createReadablePasssthroughStream(
  readable: Readable,
  onBody: (body: Buffer) => void
) {
  const readDataStream = new PassThrough();
  const passthroughStream = new PassThrough();

  readable.on('data', (chunk) => {
    readDataStream.write(chunk);
    passthroughStream.write(chunk);
  });
  readable.on('end', () => {
    readDataStream.end();
    passthroughStream.end();
  });
  readable.on('error', (error) => {
    readDataStream.destroy(error);
    passthroughStream.destroy(error);
  });

  // Now we can also read from originalStream in the background.
  const chunks: Buffer[] = [];
  readDataStream.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });
  readDataStream.on('end', () => {
    const body = Buffer.concat(chunks);
    logger.debug(`Received body: ${body.byteLength} bytes`);
    onBody(body);
  });

  // Return the PassThrough stream so the caller can also read from it.
  return passthroughStream;
}

export async function startServer(): Promise<{
  address: string;
  server: FastifyInstance;
}> {
  const server = fastify({ logger });

  await server.register(cors, {
    preflightContinue: false, // Do _not_ pass the CORS preflight OPTIONS request to stacks-node because its http server doesn't properly support it
    strictPreflight: false, // Unnecessarily strict CORS preflight checks
    methods: ALLOW_REQUEST_METHODS,
    allowedHeaders: ALLOW_REQUEST_HEADERS,
    exposedHeaders: ALLOW_RESPONSE_HEADERS,
  });

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

  // Note: paths in upstream are ignored
  const upstream = `http://${ENV.STACKS_CORE_PROXY_HOST}:${ENV.STACKS_CORE_PROXY_PORT}${STACKS_NODE_RPC_PREFIX}`;
  logger.info(`Proxying to upstream: ${upstream}`);

  await server.register(proxy, {
    upstream: upstream,
    prefix: STACKS_NODE_RPC_PREFIX, // only handle requests that start with this prefix
    rewritePrefix: STACKS_NODE_RPC_PREFIX, // ensure same prefix is used for upstream requests
    replyOptions: {
      rewriteRequestHeaders(request, headers) {
        headers['x-test'] = '1234';
        return headers;
      },
      onResponse(request, reply, res) {
        if (
          isTxMulticastEnabled() &&
          request.method === 'POST' &&
          request.url === '/v2/transactions'
        ) {
          postTxMulticast(request, reply, null).catch((error) => {
            logger.error(error, `Error performing tx-multicast: ${error}`);
          });
        }
        const readable = createReadablePasssthroughStream(
          res as unknown as Readable,
          (body) => {
            const bodyString = body.toString();
            console.log(bodyString);
          }
        );
        reply.send(readable);
        // TODO: good area for doing tx-multicast?
        // res.setHeader('x-test', '4567');
        // reply.send(res);
      },
    },
  });

  const address = await server.listen({
    host: ENV.RPC_PROXY_HOST,
    port: ENV.RPC_PROXY_PORT,
  });

  return {
    server,
    address,
  };
}

Promise.resolve(() => setupShutdownHandler())
  .then(() => startServer())
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
