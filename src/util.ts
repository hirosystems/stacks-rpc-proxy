import { pino, LevelWithSilent as PinoLogLevel } from 'pino';
import { envSchema } from 'env-schema';
import { Static, Type } from '@sinclair/typebox';

export const LogLevel: { [K in PinoLogLevel]: K } = {
  fatal: 'fatal',
  error: 'error',
  warn: 'warn',
  info: 'info',
  debug: 'debug',
  trace: 'trace',
  silent: 'silent',
} as const;

const NodeEnv = {
  production: 'production',
  development: 'development',
  test: 'test',
} as const;

const schema = Type.Object({
  NODE_ENV: Type.Enum(NodeEnv),
  LOG_LEVEL: Type.Enum(LogLevel, { default: 'debug' }),
  RPC_PROXY_HOST: Type.String({ default: '0.0.0.0' }),
  RPC_PROXY_PORT: Type.Number({ default: 5444 }),
  STACKS_CORE_PROXY_HOST: Type.String(),
  STACKS_CORE_PROXY_PORT: Type.Number(),
  STACKS_API_PROXY_CACHE_CONTROL_FILE: Type.Optional(
    Type.String({
      description:
        'Path to JSON file containing cache-control config for paths',
    })
  ),
  STACKS_API_EXTRA_TX_ENDPOINTS_FILE: Type.Optional(
    Type.String({
      description: 'Additional stacks-node endpoints to POST transactions to',
    })
  ),
  MAX_REQUEST_BODY_SIZE: Type.Number({
    default: 1024 * 1024 * 2,
    description: 'Max HTTP request body content size in bytes, defaults to 2MB',
  }),
  PROMETHEUS_HOST: Type.String({ default: '0.0.0.0' }),
  PROMETHEUS_PORT: Type.Number({ default: 9153 }),
  LOG_RESPONSES: Type.Boolean({
    default: false,
    description:
      'Print upstream response bodies. This increases memory and CPU usage and should only be used for debugging',
  }),
  LOG_REQUESTS: Type.Boolean({
    default: false,
    description:
      'Print request bodies. This increases memory and CPU usage and should only be used for debugging',
  }),
});

export const ENV = envSchema<Static<typeof schema>>({
  dotenv: true,
  schema,
});

export const loggerOpts: pino.LoggerOptions = {
  level: ENV.LOG_LEVEL,
  formatters: { level: (level) => ({ level }) },
};
if (ENV.NODE_ENV !== 'production') {
  loggerOpts.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'hostname,pid',
    },
  };
}
export const logger = pino(loggerOpts);
