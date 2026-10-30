import { INestApplication } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { HttpExceptionFilter } from './common/errors/http-exception.filter.js';
import { createValidationPipe } from './common/validation/validation.pipe.js';

/** Configuración compartida por main.ts y las pruebas e2e. */
export function configureApp(app: INestApplication): void {
  // Los Logger de Nest (new Logger(...)) escriben a través de pino.
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
}
