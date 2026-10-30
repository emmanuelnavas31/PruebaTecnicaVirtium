import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/errors/app.exception.js';
import type { Env } from '../config/env.js';

interface AttemptState {
  failures: number;
  /** Momento del primer fallo de la ventana actual. */
  windowStart: number;
  lockedUntil: number;
}

/**
 * Límite de intentos fallidos de login por email (en memoria).
 * Aplica igual a emails inexistentes, así no revela cuáles están registrados.
 */
@Injectable()
export class LoginAttemptsService {
  private readonly attempts = new Map<string, AttemptState>();
  private readonly maxAttempts: number;
  private readonly lockMs: number;

  constructor(config: ConfigService<Env, true>) {
    this.maxAttempts = config.get('LOGIN_MAX_ATTEMPTS', { infer: true });
    this.lockMs = config.get('LOGIN_LOCK_SECONDS', { infer: true }) * 1000;
  }

  /** Lanza 429 si el email está bloqueado. */
  assertNotLocked(key: string, now = Date.now()): void {
    const state = this.current(key, now);
    if (state && state.lockedUntil > now) throw this.lockedError(state, now);
  }

  /** Registra un fallo. Devuelve los intentos restantes o lanza 429 si se agotaron. */
  registerFailure(key: string, now = Date.now()): number {
    const state = this.current(key, now) ?? {
      failures: 0,
      windowStart: now,
      lockedUntil: 0,
    };
    state.failures += 1;
    if (state.failures >= this.maxAttempts) {
      state.lockedUntil = now + this.lockMs;
      this.attempts.set(key, state);
      throw this.lockedError(state, now);
    }
    this.attempts.set(key, state);
    return this.maxAttempts - state.failures;
  }

  registerSuccess(key: string): void {
    this.attempts.delete(key);
  }

  /** Estado vigente; los fallos viejos y los bloqueos vencidos se descartan. */
  private current(key: string, now: number): AttemptState | undefined {
    const state = this.attempts.get(key);
    if (!state) return undefined;
    const lockExpired = state.lockedUntil > 0 && state.lockedUntil <= now;
    const windowExpired =
      state.lockedUntil === 0 && now - state.windowStart >= this.lockMs;
    if (lockExpired || windowExpired) {
      this.attempts.delete(key);
      return undefined;
    }
    return state;
  }

  private lockedError(state: AttemptState, now: number): AppException {
    const retryAfterSeconds = Math.ceil((state.lockedUntil - now) / 1000);
    return new AppException(
      429,
      'TOO_MANY_LOGIN_ATTEMPTS',
      'Demasiados intentos fallidos. Intenta de nuevo más tarde',
      { retryAfterSeconds },
    );
  }
}
