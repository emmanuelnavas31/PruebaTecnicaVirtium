import { hashSync } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { Db } from './database.service.js';
import { users } from './schema.js';

/** Usuarios de prueba (ver README). u_123 es el del webhook de ejemplo. */
export const SEED_USERS = [
  { id: 'u_123', email: 'ana@orbita.test', password: 'Orbita123!' },
  { id: 'u_456', email: 'luis@orbita.test', password: 'Orbita456!' },
];

/** Idempotente: solo inserta los usuarios que faltan. */
export function seed(db: Db): void {
  for (const user of SEED_USERS) {
    const existing = db.select().from(users).where(eq(users.id, user.id)).get();
    if (existing) continue;
    db.insert(users)
      .values({
        id: user.id,
        email: user.email,
        passwordHash: hashSync(user.password, 10),
        createdAt: new Date().toISOString(),
      })
      .run();
  }
}
