import { IsIn } from 'class-validator';
import { CURRENCY } from '../../common/money/money.js';
import { IsUsdAmount } from '../../common/validation/is-usd-amount.decorator.js';

export class OperationDto {
  /** Monto positivo en USD con máximo 2 decimales (máx. 10000.00). @example "150.25" */
  @IsUsdAmount()
  amount: string;

  /** @example USD */
  @IsIn([CURRENCY], { message: 'currency debe ser USD' })
  currency: 'USD';
}
