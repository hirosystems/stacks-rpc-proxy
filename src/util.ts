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
  STACKS_API_PROXY_CACHE_CONTROL_FILE: Type.String({
    default: 'config/proxy-cache-control.json',
  }),
  STACKS_API_EXTRA_TX_ENDPOINTS_FILE: Type.String({
    default: 'config/extra-tx-endpoints.txt',
  }),
});

export const ENV = envSchema<Static<typeof schema>>({
  dotenv: true,
  schema,
});

export const loggerOpts: pino.LoggerOptions = {
  level: ENV.LOG_LEVEL,
};
if (ENV.NODE_ENV !== 'production') {
  loggerOpts.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  };
}
export const logger = pino(loggerOpts);
