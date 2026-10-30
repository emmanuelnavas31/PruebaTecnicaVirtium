import { Module } from '@nestjs/common';
import { BalancesModule } from '../balances/balances.module.js';
import { WebhookSignatureGuard } from './webhook-signature.guard.js';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';

@Module({
  imports: [BalancesModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookSignatureGuard],
})
export class WebhooksModule {}
