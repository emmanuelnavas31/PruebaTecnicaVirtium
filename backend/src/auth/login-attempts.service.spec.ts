import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/errors/app.exception.js';
import { LoginAttemptsService } from './login-attempts.service.js';

const config = {
  get: (key: string) => ({ LOGIN_MAX_ATTEMPTS: 3, LOGIN_LOCK_SECONDS: 300 })[key],
} as unknown as ConfigService;

describe('LoginAttemptsService', () => {
  let service: LoginAttemptsService;
  const t0 = 1_000_000;

  beforeEach(() => {
    service = new LoginAttemptsService(config as never);
  });

  const lockError = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      return error as AppException;
    }
    throw new Error('Se esperaba un bloqueo');
  };

  it('cuenta los intentos restantes y bloquea al tercer fallo', () => {
    expect(service.registerFailure('ana', t0)).toBe(2);
    expect(service.registerFailure('ana', t0)).toBe(1);
    const error = lockError(() => service.registerFailure('ana', t0));
    expect(error.getStatus()).toBe(429);
    expect(error.details).toEqual({ retryAfterSeconds: 300 });
  });

  it('mientras está bloqueado rechaza y al vencer el bloqueo se libera', () => {
    for (let i = 0; i < 2; i++) service.registerFailure('ana', t0);
    lockError(() => service.registerFailure('ana', t0));

    expect(lockError(() => service.assertNotLocked('ana', t0 + 60_000)).details).toEqual({
      retryAfterSeconds: 240,
    });
    expect(() => service.assertNotLocked('ana', t0 + 300_000)).not.toThrow();
    expect(service.registerFailure('ana', t0 + 300_000)).toBe(2);
  });

  it('un login exitoso reinicia el contador', () => {
    service.registerFailure('ana', t0);
    service.registerFailure('ana', t0);
    service.registerSuccess('ana');
    expect(service.registerFailure('ana', t0)).toBe(2);
  });

  it('los fallos viejos expiran y los emails son independientes', () => {
    service.registerFailure('ana', t0);
    service.registerFailure('ana', t0);
    expect(service.registerFailure('luis', t0)).toBe(2);
    expect(service.registerFailure('ana', t0 + 300_000)).toBe(2);
  });
});
