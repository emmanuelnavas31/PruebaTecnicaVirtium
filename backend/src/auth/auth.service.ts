import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {JwtService} from '@nestjs/jwt';
import {compare, hashSync} from 'bcryptjs';
import {eq} from 'drizzle-orm';
import {AppException} from '../common/errors/app.exception.js';
import type {Env} from '../config/env.js';
import {DatabaseService} from '../database/database.service.js';
import {users} from '../database/schema.js';
import {LoginResponseDto} from './dto/login.dto.js';
import {LoginAttemptsService} from './login-attempts.service.js';

// Hash de relleno: si el email no existe igual se ejecuta bcrypt, así el tiempo
// de respuesta no revela qué emails están registrados.
const DUMMY_HASH = hashSync('orbita-dummy-password', 10);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly attempts: LoginAttemptsService,
  ) {
  }

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const normalizedEmail = email.trim().toLowerCase();
    this.attempts.assertNotLocked(normalizedEmail);

    const user = this.database.db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .get();

    const valid = await compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      // Mismo error para email inexistente y contraseña incorrecta.
      let remainingAttempts: number;
      try {
        remainingAttempts = this.attempts.registerFailure(normalizedEmail);
      } catch (error) {
        this.logger.warn({ email: normalizedEmail }, 'Login bloqueado por intentos fallidos');
        throw error;
      }
      this.logger.warn({ email: normalizedEmail, remainingAttempts }, 'Login fallido');
      throw new AppException(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos', {
        remainingAttempts,
      });
    }

    this.attempts.registerSuccess(normalizedEmail);
    this.logger.log({ userId: user.id }, 'Login exitoso');

    const expiresIn = this.config.get('JWT_TTL_SECONDS', {infer: true});
    const accessToken = await this.jwt.signAsync({sub: user.id, email: user.email});
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      user: {id: user.id, email: user.email},
    };
  }
}
