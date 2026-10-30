import { IsIn, IsString, Length } from 'class-validator';
import { CURRENCY } from '../../common/money/money.js';
import { IsUsdAmount } from '../../common/validation/is-usd-amount.decorator.js';

export class PaymentGatewayEventDto {
  /** @example evt_8f2a */
  @IsString()
  @Length(1, 100)
  event_id: string;

  /** @example u_123 */
  @IsString()
  @Length(1, 100)
  user_id: string;

  /** @example "200.00" */
  @IsUsdAmount()
  amount: string;

  /** @example USD */
  @IsIn([CURRENCY], { message: 'currency debe ser USD' })
  currency: 'USD';

  /** @example approved */
  @IsIn(['approved', 'rejected'], { message: 'status debe ser approved o rejected' })
  status: 'approved' | 'rejected';
}

export class WebhookAckDto {
  received: true;
  eventId: string;
  outcome: 'CREDITED' | 'REJECTED' | 'USER_NOT_FOUND';
  /** true si el evento ya se había recibido antes (no se vuelve a aplicar). */
  duplicate: boolean;
}
