export interface Env {
  NODE_ENV: string;
  PORT: number;
  JWT_SECRET: string;
  JWT_TTL_SECONDS: number;
  WEBHOOK_SECRET: string;
  DB_PATH: string;
}

/** Valida las variables de entorno. En producción los secretos son obligatorios. */
const text = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback;

export function validateEnv(raw: Record<string, unknown>): Env {
  const nodeEnv = text(raw.NODE_ENV, 'development');
  const secret = (name: string, devDefault: string): string => {
    const value = raw[name];
    if (typeof value === 'string' && value.length > 0) return value;
    if (nodeEnv === 'production') throw new Error(`Falta la variable ${name}`);
    return devDefault;
  };

  const ttl = Number(raw.JWT_TTL_SECONDS ?? 900);
  if (!Number.isInteger(ttl) || ttl <= 0) {
    throw new Error('JWT_TTL_SECONDS debe ser un entero positivo');
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: Number(raw.PORT ?? 3000),
    JWT_SECRET: secret('JWT_SECRET', 'dev-jwt-secret'),
    JWT_TTL_SECONDS: ttl,
    WEBHOOK_SECRET: secret('WEBHOOK_SECRET', 'dev-webhook-secret'),
    DB_PATH: text(raw.DB_PATH, './data/orbita.sqlite'),
  };
}
