import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ANA, createTestApp, loginAs } from './helpers.js';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createTestApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('login correcto devuelve un token Bearer con expiración', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send(ANA).expect(200);
    expect(res.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: 'u_123', email: ANA.email },
    });
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('email inexistente y contraseña incorrecta devuelven el mismo error', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ANA.email, password: 'incorrecta' })
      .expect(401);
    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nadie@orbita.test', password: 'incorrecta' })
      .expect(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('login con body inválido responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'no-es-email' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    ['sin token', undefined, 'MISSING_TOKEN'],
    ['token inválido', 'Bearer abc.def.ghi', 'INVALID_TOKEN'],
    ['esquema distinto a Bearer', 'Basic abc', 'MISSING_TOKEN'],
  ])('%s responde 401', async (_case, header, code) => {
    const req = request(app.getHttpServer()).get('/balances/me');
    if (header) req.set('Authorization', header);
    const res = await req.expect(401);
    expect(res.body.code).toBe(code);
  });

  it('token vencido responde 401 TOKEN_EXPIRED', async () => {
    const expired = await app
      .get(JwtService)
      .signAsync({ sub: 'u_123', email: ANA.email }, { expiresIn: -10 });
    const res = await request(app.getHttpServer())
      .get('/balances/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  it('el usuario sale del token, no del body', async () => {
    const token = await loginAs(app, ANA);
    const res = await request(app.getHttpServer())
      .post('/balances/me/deposits')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'k-user-id')
      .send({ amount: '10.00', currency: 'USD', user_id: 'u_456' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
