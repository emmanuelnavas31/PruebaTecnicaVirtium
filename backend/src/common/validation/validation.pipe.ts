import { ValidationError, ValidationPipe } from '@nestjs/common';
import { AppException } from '../errors/app.exception.js';

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    // Rechaza campos extra, p. ej. un user_id en el body de un depósito.
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new AppException(
        400,
        'VALIDATION_ERROR',
        'Los datos enviados no son válidos',
        errors.map((e) => ({
          field: e.property,
          messages: Object.values(e.constraints ?? {}),
        })),
      ),
  });
}
