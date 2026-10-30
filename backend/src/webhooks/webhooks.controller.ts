import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { PaymentGatewayEventDto, WebhookAckDto } from './dto/payment-gateway-event.dto.js';
import { WebhookSignatureGuard } from './webhook-signature.guard.js';
import { WebhooksService } from './webhooks.service.js';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post('payment-gateway')
  @HttpCode(200)
  @UseGuards(WebhookSignatureGuard)
  @ApiSecurity('webhook-signature')
  @ApiOperation({
    summary: 'Notificación de la pasarela de pagos',
    description:
      'Autenticado con X-Signature = hex(HMAC-SHA256(body, WEBHOOK_SECRET)). ' +
      'Idempotente por event_id: las reentregas no vuelven a acreditar.',
  })
  @ApiOkResponse({ type: WebhookAckDto })
  @ApiUnauthorizedResponse({ description: 'INVALID_SIGNATURE' })
  handle(
    @Body() event: PaymentGatewayEventDto,
    @Req() req: Request & { rawBody?: Buffer },
  ): WebhookAckDto {
    return this.webhooks.process(event, req.rawBody?.toString('utf8') ?? JSON.stringify(event));
  }
}
