import { ConfigService } from '@nestjs/config';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Params } from 'nestjs-pino';
import type { Env } from './env.js';

type Req = IncomingMessage & { user?: { id: string } };

/**
 * Logs estructurados con pino: JSON en producción, una línea legible en desarrollo.
 * Cada petición lleva un request id (X-Request-Id) que se repite en todos sus logs.
 */
export function loggerConfig(config: ConfigService<Env, true>): Params {
  const production = config.get('NODE_ENV', { infer: true }) === 'production';

  return {
    pinoHttp: {
      level: config.get('LOG_LEVEL', { infer: true }),
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const incoming = req.headers['x-request-id'];
        const id =
          typeof incoming === 'string' && incoming.length <= 100
            ? incoming
            : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      // Nunca se escriben tokens, firmas ni contraseñas en los logs.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers["x-signature"]',
          'req.headers.cookie',
        ],
        censor: '[REDACTED]',
      },
      serializers: {
        req: (req: { id: string; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      customProps: (req: Req) => (req.user ? { userId: req.user.id } : {}),
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      autoLogging: { ignore: (req) => req.url === '/health' },
      transport: production
        ? undefined
        : {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
          },
    },
  };
}
