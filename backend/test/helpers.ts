import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

export const ANA = { email: 'ana@orbita.test', password: 'Orbita123!' };
export const LUIS = { email: 'luis@orbita.test', password: 'Orbita456!' };
export const WEBHOOK_SECRET = 'test-webhook-secret';

export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ rawBody: true });
  configureApp(app);
  await app.init();
  return app;
}

export async function loginAs(
  app: INestApplication<App>,
  credentials: { email: string; password: string },
): Promise<string> {
  const res = await request(app.getHttpServer()).post('/auth/login').send(credentials).expect(200);
  return res.body.accessToken as string;
}

export function operation(
  app: INestApplication<App>,
  token: string,
  kind: 'deposits' | 'withdrawals',
  amount: string,
  key: string = randomUUID(),
) {
  return request(app.getHttpServer())
    .post(`/balances/me/${kind}`)
    .set('Authorization', `Bearer ${token}`)
    .set('Idempotency-Key', key)
    .send({ amount, currency: 'USD' });
}

export function sign(body: string, secret = WEBHOOK_SECRET): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}
