export interface Env {
  NODE_ENV: string;
  PORT: number;
  JWT_SECRET: string;
  JWT_TTL_SECONDS: number;
  WEBHOOK_SECRET: string;
  DB_PATH: string;
  LOGIN_MAX_ATTEMPTS: number;
  LOGIN_LOCK_SECONDS: number;
  LOG_LEVEL: string;
}

const text = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback;

const positiveInt = (value: unknown, fallback: number, name: string): number => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} debe ser un entero positivo`);
  }
  return parsed;
};

/** Valida las variables de entorno. En producción los secretos son obligatorios. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const nodeEnv = text(raw.NODE_ENV, 'development');
  const secret = (name: string, devDefault: string): string => {
    const value = raw[name];
    if (typeof value === 'string' && value.length > 0) return value;
    if (nodeEnv === 'production') throw new Error(`Falta la variable ${name}`);
    return devDefault;
  };

  return {
    NODE_ENV: nodeEnv,
    PORT: Number(raw.PORT ?? 3000),
    JWT_SECRET: secret('JWT_SECRET', 'dev-jwt-secret'),
    JWT_TTL_SECONDS: positiveInt(raw.JWT_TTL_SECONDS, 900, 'JWT_TTL_SECONDS'),
    WEBHOOK_SECRET: secret('WEBHOOK_SECRET', 'dev-webhook-secret'),
    DB_PATH: text(raw.DB_PATH, './data/orbita.sqlite'),
    LOGIN_MAX_ATTEMPTS: positiveInt(raw.LOGIN_MAX_ATTEMPTS, 3, 'LOGIN_MAX_ATTEMPTS'),
    LOGIN_LOCK_SECONDS: positiveInt(raw.LOGIN_LOCK_SECONDS, 300, 'LOGIN_LOCK_SECONDS'),
    LOG_LEVEL: text(raw.LOG_LEVEL, nodeEnv === 'production' ? 'info' : 'debug'),
  };
}
