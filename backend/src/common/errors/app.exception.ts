import { HttpException } from '@nestjs/common';

export interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

/** Error de la API con un código estable que el front puede traducir. */
export class AppException extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super({ statusCode: status, code, message, details } satisfies ErrorBody, status);
  }

  static fromBody(body: ErrorBody): AppException {
    return new AppException(body.statusCode, body.code, body.message, body.details);
  }
}
