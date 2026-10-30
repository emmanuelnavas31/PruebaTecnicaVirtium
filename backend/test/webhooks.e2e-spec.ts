import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ANA, createTestApp, loginAs, sign } from './helpers.js';

const event = (overrides: Record<string, string> = {}) =>
  JSON.stringify({
    event_id: 'evt_8f2a',
    user_id: 'u_123',
    amount: '200.00',
    currency: 'USD',
    status: 'approved',
    ...overrides,
  });

describe('Webhook payment-gateway (e2e)', () => {
  let app: INestApplication<App>;

  const send = (body: string, signature = sign(body)) =>
    request(app.getHttpServer())
      .post('/webhooks/payment-gateway')
      .set('Content-Type', 'application/json')
      .set('X-Signature', signature)
      .send(body);

  const balanceOfAna = async () => {
    const token = await loginAs(app, ANA);
    const res = await request(app.getHttpServer())
      .get('/balances/me')
      .set('Authorization', `Bearer ${token}`);
    return res.body.amount as string;
  };

  beforeEach(async () => {
    app = await createTestApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('evento aprobado acredita el monto al usuario', async () => {
    const res = await send(event()).expect(200);
    expect(res.body).toEqual({ received: true, eventId: 'evt_8f2a', outcome: 'CREDITED', duplicate: false });
    expect(await balanceOfAna()).toBe('200.00');
  });

  it('el mismo evento enviado varias veces acredita una sola vez', async () => {
    await send(event()).expect(200);
    const again = await send(event()).expect(200);
    expect(again.body.duplicate).toBe(true);
    expect(await balanceOfAna()).toBe('200.00');
  });

  it('evento rechazado no acredita', async () => {
    const res = await send(event({ event_id: 'evt_rej', status: 'rejected' })).expect(200);
    expect(res.body.outcome).toBe('REJECTED');
    expect(await balanceOfAna()).toBe('0.00');
  });

  it('usuario inexistente se registra sin acreditar', async () => {
    const res = await send(event({ event_id: 'evt_x', user_id: 'u_999' })).expect(200);
    expect(res.body.outcome).toBe('USER_NOT_FOUND');
  });

  it.each([
    ['sin firma', ''],
    ['firma con otro secreto', sign(event(), 'otro-secreto')],
    ['firma con formato inválido', 'zzz'],
  ])('%s responde 401', async (_case, signature) => {
    const res = await send(event(), signature).expect(401);
    expect(res.body.code).toBe('INVALID_SIGNATURE');
    expect(await balanceOfAna()).toBe('0.00');
  });

  it('firma calculada sobre otro body (body alterado) responde 401', async () => {
    await send(event({ amount: '9999.00' }), sign(event())).expect(401);
  });

  it('body con firma válida pero datos inválidos responde 400', async () => {
    const res = await send(event({ amount: '1.999' })).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
