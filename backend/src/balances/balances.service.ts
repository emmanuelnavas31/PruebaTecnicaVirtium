import {Injectable, Logger} from '@nestjs/common';
import {and, count, desc, eq} from 'drizzle-orm';
import {createHash} from 'node:crypto';
import {AppException, ErrorBody} from '../common/errors/app.exception.js';
import {toCents} from '../common/money/money.js';
import {DatabaseService} from '../database/database.service.js';
import {idempotencyKeys, transactions} from '../database/schema.js';
import type {
  BalanceDto,
  OperationResultDto,
  TransactionPageDto,
} from './dto/balance-responses.dto.js';
import type {OperationDto} from './dto/operation.dto.js';
import {LedgerService, toBalanceDto, toTransactionDto} from './ledger.service.js';

export type Operation = 'DEPOSIT' | 'WITHDRAWAL';

export interface OperationOutcome {
  body: OperationResultDto;
  /** true si la respuesta viene de una solicitud anterior con la misma Idempotency-Key. */
  replayed: boolean;
}

const MAX_KEY_LENGTH = 255;

@Injectable()
export class BalancesService {
  private readonly logger = new Logger(BalancesService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly ledger: LedgerService,
  ) {
  }

  getBalance(userId: string): BalanceDto {
    return toBalanceDto(this.database.transaction((tx) => this.ledger.ensureBalance(tx, userId)));
  }

  /**
   * Depósito o retiro idempotente. En una sola transacción: busca la llave, aplica
   * el movimiento y guarda la respuesta. Reintentos con la misma llave y el mismo
   * body devuelven la respuesta original (también si fue "saldo insuficiente").
   */
  operate(
    userId: string,
    operation: Operation,
    dto: OperationDto,
    key: string | undefined,
  ): OperationOutcome {
    const idempotencyKey = this.validateKey(key);
    const amountCents = toCents(dto.amount);
    const requestHash = createHash('sha256')
      .update(`${operation}:${amountCents}:${dto.currency}`)
      .digest('hex');

    const result = this.database.transaction((tx) => {
      const existing = tx
        .select()
        .from(idempotencyKeys)
        .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, idempotencyKey)))
        .get();
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new AppException(
            409,
            'IDEMPOTENCY_KEY_REUSED',
            'La Idempotency-Key ya se usó con una operación o monto distinto',
          );
        }
        return {
          status: existing.responseStatus,
          body: JSON.parse(existing.responseBody) as OperationResultDto | ErrorBody,
          replayed: true,
        };
      }

      let status = 201;
      let body: OperationResultDto | ErrorBody;
      let transactionId: number | null = null;
      try {
        const applied = this.ledger.applyMovement(tx, userId, operation, amountCents, {
          idempotencyKey,
        });
        body = applied;
        transactionId = applied.transaction.id;
      } catch (error) {
        // El rechazo de negocio también se guarda: reintentar da el mismo resultado.
        if (!(error instanceof AppException) || error.code !== 'INSUFFICIENT_FUNDS') throw error;
        status = error.getStatus();
        body = error.getResponse() as ErrorBody;
      }

      tx.insert(idempotencyKeys)
        .values({
          userId,
          key: idempotencyKey,
          operation,
          requestHash,
          responseStatus: status,
          responseBody: JSON.stringify(body),
          transactionId,
          createdAt: new Date().toISOString(),
        })
        .run();
      return {status, body, replayed: false};
    });

    const logContext = {userId, operation, amount: dto.amount, idempotencyKey, replayed: result.replayed};
    if (result.status >= 400) {
      this.logger.warn({...logContext, code: (result.body as ErrorBody).code}, 'Operación rechazada');
      throw AppException.fromBody(result.body as ErrorBody);
    }
    this.logger.log(
      {...logContext, transactionId: (result.body as OperationResultDto).transaction.id},
      result.replayed ? 'Operación repetida con la misma Idempotency-Key' : 'Operación aplicada',
    );
    return {body: result.body as OperationResultDto, replayed: result.replayed};
  }

  listTransactions(userId: string, page: number, limit: number): TransactionPageDto {
    const db = this.database.db;
    const rows = db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.id))
      .limit(limit)
      .offset((page - 1) * limit)
      .all();
    const total =
      db.select({total: count()}).from(transactions).where(eq(transactions.userId, userId)).get()
        ?.total ?? 0;

    return {
      data: rows.map(toTransactionDto),
      pagination: {page, limit, total, totalPages: Math.ceil(total / limit)},
    };
  }

  private validateKey(key: string | undefined): string {
    const value = key?.trim();
    if (!value) {
      throw new AppException(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Falta el header Idempotency-Key');
    }
    if (value.length > MAX_KEY_LENGTH) {
      throw new AppException(
        400,
        'IDEMPOTENCY_KEY_INVALID',
        `Idempotency-Key no puede superar ${MAX_KEY_LENGTH} caracteres`,
      );
    }
    return value;
  }
}
