import {ValidateBy, ValidationOptions} from 'class-validator';
import {amountError} from '../money/money.js';

export function IsUsdAmount(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isUsdAmount',
      validator: {
        validate: (value) => amountError(value) === null,
        defaultMessage: (args) => amountError(args?.value) ?? 'amount inválido',
      },
    },
    options,
  );
}
