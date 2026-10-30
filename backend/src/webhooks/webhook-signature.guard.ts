import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppException } from '../common/errors/app.exception.js';
import type { Env } from '../config/env.js';

/** Verifica X-Signature = HMAC-SHA256(raw body, WEBHOOK_SECRET) en hexadecimal. */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    const signature = req.header('x-signature')?.trim().toLowerCase() ?? '';
    const expected = createHmac('sha256', this.config.get('WEBHOOK_SECRET', { infer: true }))
      .update(req.rawBody ?? Buffer.alloc(0))
      .digest('hex');

    const valid =
      /^[0-9a-f]{64}$/.test(signature) &&
      timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    if (!valid) {
      this.logger.warn(`Firma inválida desde ${req.ip}`);
      throw new AppException(401, 'INVALID_SIGNATURE', 'La firma X-Signature no es válida');
    }
    return true;
  }
}
