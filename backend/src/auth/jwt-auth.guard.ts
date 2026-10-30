import {CanActivate, ExecutionContext, Injectable} from '@nestjs/common';
import {JwtService, TokenExpiredError} from '@nestjs/jwt';
import {Request} from 'express';
import type {AuthUser} from '../common/auth-user.js';
import {AppException} from '../common/errors/app.exception.js';

interface JwtPayload {
  sub: string;
  email: string;
}

/** Exige `Authorization: Bearer <token>`; el usuario sale siempre del token. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new AppException(401, 'MISSING_TOKEN', 'Falta el token de acceso');
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      req.user = {id: payload.sub, email: payload.email};
      return true;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new AppException(401, 'TOKEN_EXPIRED', 'La sesión expiró');
      }
      throw new AppException(401, 'INVALID_TOKEN', 'El token de acceso no es válido');
    }
  }
}
