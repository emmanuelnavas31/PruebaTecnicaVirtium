import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {JwtService} from '@nestjs/jwt';
import {compare, hashSync} from 'bcryptjs';
import {eq} from 'drizzle-orm';
import {AppException} from '../common/errors/app.exception.js';
import type {Env} from '../config/env.js';
import {DatabaseService} from '../database/database.service.js';
import {users} from '../database/schema.js';
import {LoginResponseDto} from './dto/login.dto.js';

// Hash de relleno: si el email no existe igual se ejecuta bcrypt, así el tiempo
// de respuesta no revela qué emails están registrados.
const DUMMY_HASH = hashSync('orbita-dummy-password', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {
  }

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = this.database.db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .get();

    const valid = await compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      // Mismo error para email inexistente y contraseña incorrecta.
      throw new AppException(401, 'INVALID_CREDENTIALS', 'Email o contraseña incorrectos');
    }

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
