import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { AppException } from '../common/errors/app.exception.js';
import { CURRENCY, fromCents } from '../common/money/money.js';
import type { DbExecutor } from '../database/database.service.js';
import { balances, transactions, TransactionType } from '../database/schema.js';
import type { BalanceDto, OperationResultDto, TransactionDto } from './dto/balance-responses.dto.js';

type BalanceRow = typeof balances.$inferSelect;
type TransactionRow = typeof transactions.$inferSelect;

export interface MovementSource {
  idempotencyKey?: string;
  webhookEventId?: string;
}

/**
 * Única pieza que modifica saldos. Debe llamarse dentro de una transacción
 * (DatabaseService.transaction) para que saldo y movimiento se escriban juntos.
 */
@Injectable()
export class LedgerService {
  /** Devuelve el saldo del usuario; si no existe lo crea en 0. */
  ensureBalance(db: DbExecutor, userId: string): BalanceRow {
    db.insert(balances)
      .values({ userId, amountCents: 0, currency: CURRENCY, updatedAt: new Date().toISOString() })
      .onConflictDoNothing()
      .run();
    return db.select().from(balances).where(eq(balances.userId, userId)).get()!;
  }

  applyMovement(
    db: DbExecutor,
    userId: string,
    type: TransactionType,
    amountCents: number,
    source: MovementSource,
  ): OperationResultDto {
    const balance = this.ensureBalance(db, userId);
    const delta = type === 'WITHDRAWAL' ? -amountCents : amountCents;
    const nextCents = balance.amountCents + delta;
    if (nextCents < 0) {
      throw new AppException(422, 'INSUFFICIENT_FUNDS', 'Saldo insuficiente para el retiro', {
        available: fromCents(balance.amountCents),
      });
    }

    const now = new Date().toISOString();
    const updated = db
      .update(balances)
      .set({ amountCents: nextCents, updatedAt: now })
      .where(eq(balances.userId, userId))
      .returning()
      .get();
    const transaction = db
      .insert(transactions)
      .values({
        userId,
        type,
        amountCents,
        balanceAfterCents: nextCents,
        currency: CURRENCY,
        idempotencyKey: source.idempotencyKey,
        webhookEventId: source.webhookEventId,
        createdAt: now,
      })
      .returning()
      .get();

    return { transaction: toTransactionDto(transaction), balance: toBalanceDto(updated) };
  }
}

export function toBalanceDto(row: BalanceRow): BalanceDto {
  return {
    userId: row.userId,
    amount: fromCents(row.amountCents),
    currency: row.currency,
    updatedAt: row.updatedAt,
  };
}

export function toTransactionDto(row: TransactionRow): TransactionDto {
  return {
    id: row.id,
    type: row.type,
    amount: fromCents(row.amountCents),
    currency: row.currency,
    balanceAfter: fromCents(row.balanceAfterCents),
    createdAt: row.createdAt,
  };
}
