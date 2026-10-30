import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ANA, createTestApp, LUIS, loginAs, operation } from './helpers.js';

describe('Balances (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  const getBalance = (t = token) =>
    request(app.getHttpServer()).get('/balances/me').set('Authorization', `Bearer ${t}`);

  beforeEach(async () => {
    app = await createTestApp();
    token = await loginAs(app, ANA);
  });
  afterEach(async () => {
    await app.close();
  });

  it('el saldo se crea en 0 la primera vez', async () => {
    const res = await getBalance().expect(200);
    expect(res.body).toMatchObject({ userId: 'u_123', amount: '0.00', currency: 'USD' });
  });

  it('depósito y retiro actualizan el saldo', async () => {
    await operation(app, token, 'deposits', '150.25').expect(201);
    const res = await operation(app, token, 'withdrawals', '50.10').expect(201);
    expect(res.body.transaction).toMatchObject({ type: 'WITHDRAWAL', amount: '50.10', balanceAfter: '100.15' });
    expect((await getBalance()).body.amount).toBe('100.15');
  });

  describe('Idempotency-Key', () => {
    it('la misma llave devuelve el mismo resultado y no repite el depósito', async () => {
      const first = await operation(app, token, 'deposits', '100.00', 'dep-1').expect(201);
      const second = await operation(app, token, 'deposits', '100.00', 'dep-1').expect(201);
      expect(second.body).toEqual(first.body);
      expect(first.headers['idempotent-replayed']).toBe('false');
      expect(second.headers['idempotent-replayed']).toBe('true');
      expect((await getBalance()).body.amount).toBe('100.00');
    });

    it('solicitudes simultáneas con la misma llave acreditan una sola vez', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () => operation(app, token, 'deposits', '10.00', 'dep-par')),
      );
      results.forEach((r) => expect(r.status).toBe(201));
      expect((await getBalance()).body.amount).toBe('10.00');
    });

    it('reusar la llave con otro monto responde 409', async () => {
      await operation(app, token, 'deposits', '100.00', 'dep-2').expect(201);
      const res = await operation(app, token, 'deposits', '99.00', 'dep-2').expect(409);
      expect(res.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('reusar la llave en otra operación responde 409', async () => {
      await operation(app, token, 'deposits', '100.00', 'op-1').expect(201);
      await operation(app, token, 'withdrawals', '100.00', 'op-1').expect(409);
    });

    it('las llaves son por usuario', async () => {
      const luis = await loginAs(app, LUIS);
      await operation(app, token, 'deposits', '5.00', 'shared').expect(201);
      const res = await operation(app, luis, 'deposits', '7.00', 'shared').expect(201);
      expect(res.body.balance).toMatchObject({ userId: 'u_456', amount: '7.00' });
    });

    it('sin header Idempotency-Key responde 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/balances/me/deposits')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: '1.00', currency: 'USD' })
        .expect(400);
      expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });
  });

  describe('saldo nunca negativo', () => {
    it('retiro mayor al saldo responde 422 y no cambia el saldo', async () => {
      await operation(app, token, 'deposits', '20.00').expect(201);
      const res = await operation(app, token, 'withdrawals', '20.01').expect(422);
      expect(res.body).toMatchObject({ code: 'INSUFFICIENT_FUNDS', details: { available: '20.00' } });
      expect((await getBalance()).body.amount).toBe('20.00');
    });

    it('el rechazo se repite con la misma llave aunque luego haya saldo', async () => {
      await operation(app, token, 'withdrawals', '10.00', 'wd-1').expect(422);
      await operation(app, token, 'deposits', '50.00').expect(201);
      await operation(app, token, 'withdrawals', '10.00', 'wd-1').expect(422);
      expect((await getBalance()).body.amount).toBe('50.00');
    });

    it('retiros simultáneos no dejan el saldo negativo', async () => {
      await operation(app, token, 'deposits', '100.00').expect(201);
      const results = await Promise.all(
        Array.from({ length: 5 }, () => operation(app, token, 'withdrawals', '30.00')),
      );
      const ok = results.filter((r) => r.status === 201).length;
      expect(ok).toBe(3);
      expect((await getBalance()).body.amount).toBe('10.00');
    });
  });

  describe('validación de montos', () => {
    it.each([
      ['0', 'cero'],
      ['-5.00', 'negativo'],
      ['1.234', 'más de 2 decimales'],
      ['10000.01', 'mayor a 10000'],
      ['abc', 'no numérico'],
    ])('rechaza %s (%s)', async (amount) => {
      const res = await operation(app, token, 'deposits', amount).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('acepta exactamente 10000.00', async () => {
      await operation(app, token, 'deposits', '10000.00').expect(201);
    });

    it('rechaza monto numérico y moneda distinta de USD', async () => {
      const res = await request(app.getHttpServer())
        .post('/balances/me/deposits')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'k')
        .send({ amount: 10, currency: 'EUR' })
        .expect(400);
      expect(res.body.details.map((d: { field: string }) => d.field).sort()).toEqual(['amount', 'currency']);
    });
  });

  describe('historial', () => {
    it('lista del más reciente al más antiguo con paginación', async () => {
      for (const amount of ['1.00', '2.00', '3.00']) {
        await operation(app, token, 'deposits', amount).expect(201);
      }
      const page1 = await request(app.getHttpServer())
        .get('/balances/me/transactions?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(page1.body.data.map((t: { amount: string }) => t.amount)).toEqual(['3.00', '2.00']);
      expect(page1.body.pagination).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });

      const page2 = await request(app.getHttpServer())
        .get('/balances/me/transactions?page=2&limit=2')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(page2.body.data.map((t: { amount: string }) => t.amount)).toEqual(['1.00']);
    });

    it('solo muestra los movimientos del usuario del token', async () => {
      await operation(app, token, 'deposits', '5.00').expect(201);
      const luis = await loginAs(app, LUIS);
      const res = await request(app.getHttpServer())
        .get('/balances/me/transactions')
        .set('Authorization', `Bearer ${luis}`)
        .expect(200);
      expect(res.body.data).toEqual([]);
    });

    it('rechaza paginación inválida', async () => {
      await request(app.getHttpServer())
        .get('/balances/me/transactions?page=0&limit=500')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });
});
