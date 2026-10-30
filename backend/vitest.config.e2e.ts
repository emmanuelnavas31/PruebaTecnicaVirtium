import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Cada app de prueba usa su propia base en memoria.
    env: {
      DB_PATH: ':memory:',
      JWT_SECRET: 'test-jwt-secret',
      JWT_TTL_SECONDS: '900',
      WEBHOOK_SECRET: 'test-webhook-secret',
      LOG_LEVEL: 'silent',
    },
  },
});
