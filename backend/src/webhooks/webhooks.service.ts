import { Injectable, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { toCents } from '../common/money/money.js';
import { LedgerService } from '../balances/ledger.service.js';
import { DatabaseService } from '../database/database.service.js';
import { users, webhookEvents, WebhookOutcome } from '../database/schema.js';
import type {
  PaymentGatewayEventDto,
  WebhookAckDto,
} from './dto/payment-gateway-event.dto.js';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly ledger: LedgerService,
  ) {}

  /**
   * Procesa un evento una sola vez por event_id. Las reentregas solo suman
   * `deliveries` y devuelven el resultado original.
   */
  process(event: PaymentGatewayEventDto, rawPayload: string): WebhookAckDto {
    const ack = this.database.transaction((tx): WebhookAckDto => {
      const now = new Date().toISOString();
      const existing = tx
        .select()
        .from(webhookEvents)
        .where(eq(webhookEvents.eventId, event.event_id))
        .get();
      if (existing) {
        tx.update(webhookEvents)
          .set({
            deliveries: sql`${webhookEvents.deliveries} + 1`,
            lastReceivedAt: now,
          })
          .where(eq(webhookEvents.eventId, event.event_id))
          .run();
        return {
          received: true,
          eventId: event.event_id,
          outcome: existing.outcome,
          duplicate: true,
        };
      }

      const amountCents = toCents(event.amount);
      const user = tx
        .select()
        .from(users)
        .where(eq(users.id, event.user_id))
        .get();
      let outcome: WebhookOutcome;
      let transactionId: number | null = null;
      if (event.status === 'rejected') {
        outcome = 'REJECTED';
      } else if (!user) {
        outcome = 'USER_NOT_FOUND';
      } else {
        const applied = this.ledger.applyMovement(
          tx,
          user.id,
          'GATEWAY_CREDIT',
          amountCents,
          {
            webhookEventId: event.event_id,
          },
        );
        transactionId = applied.transaction.id;
        outcome = 'CREDITED';
      }

      tx.insert(webhookEvents)
        .values({
          eventId: event.event_id,
          userId: event.user_id,
          amountCents,
          currency: event.currency,
          status: event.status,
          outcome,
          rawPayload,
          transactionId,
          receivedAt: now,
          lastReceivedAt: now,
        })
        .run();
      return {
        received: true,
        eventId: event.event_id,
        outcome,
        duplicate: false,
      };
    });

    this.logger.log(
      {
        eventId: ack.eventId,
        userId: event.user_id,
        amount: event.amount,
        status: event.status,
        outcome: ack.outcome,
        duplicate: ack.duplicate,
      },
      ack.duplicate
        ? 'Evento de pasarela repetido (ignorado)'
        : 'Evento de pasarela procesado',
    );
    return ack;
  }
}
