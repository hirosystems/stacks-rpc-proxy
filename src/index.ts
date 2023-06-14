import { Readable, Transform } from 'node:stream';
import { IncomingMessage } from 'node:http';
import fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import proxy from '@fastify/http-proxy';
import cors from '@fastify/cors';
import { ENV, logger } from './util';
import { setupShutdownHandler } from './shutdown';
import { isTxMulticastEnabled, performTxMulticast } from './tx-post-multicast';
import { getCacheControlHeader } from './cache-control';

// TODO: prometheus metrics (use same setup as Stacks API?)

// TODO: configure error level strings for grafana/loki?

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

async function postTxMulticast(
  req: FastifyRequest,
  reply: FastifyReply,
  res: Readable
) {
  const contentType = req.headers['content-type'];
  await performTxMulticast(req.body as Buffer, contentType);
}

/**
 * Reads the upstream response body to memory and logs it.
 * @param res Response from upstream
 * @returns a new readable stream that can be used to send the response body downstream.
 */
function addResponseLogging(
  req: FastifyRequest,
  reply: FastifyReply,
  res: Readable
) {
  return readPassthrough(res, (body) => {
    const bodyString = body.toString('utf8');
    logger.debug(
      {
        method: req.method,
        url: req.url,
        status: reply.statusCode,
        response: bodyString,
      },
      `Response to ${req.method} ${req.url} returned ${reply.statusCode}: ${bodyString}`
    );
  });
}

function addRequestLogging(req: FastifyRequest) {
  const bodyString =
    (req.body as Buffer)?.toString('utf8') ?? '<no request body>';
  logger.debug(
    {
      method: req.method,
      url: req.url,
      request: bodyString,
    },
    `Request to ${req.method} ${req.url}: ${bodyString}`
  );
  return req;
}

function readPassthrough(readable: Readable, onBody: (body: Buffer) => void) {
  const chunks: Buffer[] = [];
  const transform = new Transform({
    autoDestroy: true,
    emitClose: true,
    transform(chunk, _encoding, callback) {
      chunks.push(chunk);
      callback(null, chunk);
    },
  });
  transform.on('close', () => {
    const body = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
    onBody(body);
  });
  return readable.pipe(transform);
}

function handleProxyResponse(
  request: FastifyRequest,
  reply: FastifyReply,
  response: Readable
) {
  // Handle request/response logging
  if (ENV.LOG_REQUESTS) {
    request = addRequestLogging(request);
  }
  if (ENV.LOG_RESPONSES) {
    response = addResponseLogging(request, reply, response);
  }

  // Handle tx-multicast config
  if (
    isTxMulticastEnabled() &&
    request.method === 'POST' &&
    request.url === '/v2/transactions'
  ) {
    postTxMulticast(request, reply, response).catch((error) => {
      logger.error(error, `Error performing tx-multicast: ${error}`);
    });
  }

  // Handle custom cache-control header config
  const cacheControl = getCacheControlHeader(reply.statusCode, request.url);
  if (cacheControl) {
    reply.header('Cache-Control', cacheControl);
  }

  reply.send(response);
}

export async function startServer(): Promise<{
  address: string;
  server: FastifyInstance;
}> {
  const server = fastify({ logger, bodyLimit: ENV.MAX_REQUEST_BODY_SIZE });

  await server.register(cors, {
    preflightContinue: false, // Do _not_ pass the CORS preflight OPTIONS request to stacks-node because its http server doesn't properly support it
    strictPreflight: false, // Unnecessarily strict CORS preflight checks
    methods: ALLOW_REQUEST_METHODS,
    allowedHeaders: ALLOW_REQUEST_HEADERS,
    exposedHeaders: ALLOW_RESPONSE_HEADERS,
  });

  // Note: paths in upstream are ignored
  const upstream = `http://${ENV.STACKS_CORE_PROXY_HOST}:${ENV.STACKS_CORE_PROXY_PORT}${STACKS_NODE_RPC_PREFIX}`;
  logger.info(`Proxying to upstream: ${upstream}`);

  function bodyParser(
    req: FastifyRequest,
    payload: IncomingMessage,
    done: (err: Error | null, body?: any) => void
  ) {
    let totalBytes = 0;
    const chunks: Uint8Array[] = [];
    payload.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > ENV.MAX_REQUEST_BODY_SIZE) {
        const error = new Error(
          `Request body size exceeds limit of ${ENV.MAX_REQUEST_BODY_SIZE} bytes`
        );
        Object.assign(error, { statusCode: 413 });
        done(error, undefined);
        return;
      }
      chunks.push(chunk);
    });
    payload.on('end', () => {
      done(null, Buffer.concat(chunks));
    });
    payload.on('error', (error) => {
      done(error, null);
    });
  }

  // Parse request bodies as buffers, required in order to inpsect the body for tx-multicast
  server.addContentTypeParser('application/json', bodyParser);
  server.addContentTypeParser('*', bodyParser);

  await server.register(proxy, {
    upstream: upstream,
    prefix: STACKS_NODE_RPC_PREFIX, // only handle requests that start with this prefix
    rewritePrefix: STACKS_NODE_RPC_PREFIX, // ensure same prefix is used for upstream requests
    proxyPayloads: false,
    preHandler: (request, reply, done) => {
      console.log('preHandler');
      done();
    },
    replyOptions: {
      onResponse(req, rep, res) {
        handleProxyResponse(
          req as FastifyRequest,
          rep as FastifyReply,
          res as unknown as Readable
        );
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
