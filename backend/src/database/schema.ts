import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';

export const TRANSACTION_TYPES = ['DEPOSIT', 'WITHDRAWAL', 'GATEWAY_CREDIT'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const WEBHOOK_OUTCOMES = ['CREDITED', 'REJECTED', 'USER_NOT_FOUND'] as const;
export type WebhookOutcome = (typeof WEBHOOK_OUTCOMES)[number];

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
});

/** Snapshot del saldo actual. El CHECK es la última barrera contra saldos negativos. */
export const balances = sqliteTable(
  'balances',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id),
    amountCents: integer('amount_cents').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    check('balances_amount_non_negative', sql`${t.amountCents} >= 0`),
    check('balances_currency_usd', sql`${t.currency} = 'USD'`),
  ],
);

/** Ledger append-only: cada movimiento con su origen y el saldo resultante. */
export const transactions = sqliteTable(
  'transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    type: text('type', { enum: TRANSACTION_TYPES }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    balanceAfterCents: integer('balance_after_cents').notNull(),
    currency: text('currency').notNull().default('USD'),
    idempotencyKey: text('idempotency_key'),
    webhookEventId: text('webhook_event_id').unique(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('transactions_user_id_idx').on(t.userId, t.id),
    check('transactions_amount_range', sql`${t.amountCents} > 0 AND ${t.amountCents} <= 1000000`),
    check('transactions_balance_after_non_negative', sql`${t.balanceAfterCents} >= 0`),
  ],
);

/** Respuestas ya entregadas por Idempotency-Key (por usuario). */
export const idempotencyKeys = sqliteTable(
  'idempotency_keys',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    key: text('key').notNull(),
    operation: text('operation', { enum: TRANSACTION_TYPES }).notNull(),
    requestHash: text('request_hash').notNull(),
    responseStatus: integer('response_status').notNull(),
    responseBody: text('response_body').notNull(),
    transactionId: integer('transaction_id').references(() => transactions.id),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

/** Auditoría de cada evento de la pasarela (sin FK a users: se guarda aunque no exista). */
export const webhookEvents = sqliteTable('webhook_events', {
  eventId: text('event_id').primaryKey(),
  userId: text('user_id').notNull(),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull(),
  status: text('status', { enum: ['approved', 'rejected'] }).notNull(),
  outcome: text('outcome', { enum: WEBHOOK_OUTCOMES }).notNull(),
  rawPayload: text('raw_payload').notNull(),
  deliveries: integer('deliveries').notNull().default(1),
  transactionId: integer('transaction_id').references(() => transactions.id),
  receivedAt: text('received_at').notNull(),
  lastReceivedAt: text('last_received_at').notNull(),
});
