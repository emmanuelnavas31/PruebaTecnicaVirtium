import {Global, Module} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {JwtModule} from '@nestjs/jwt';
import type {Env} from '../config/env.js';
import {AuthController} from './auth.controller.js';
import {AuthService} from './auth.service.js';
import {JwtAuthGuard} from './jwt-auth.guard.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', {infer: true}),
        signOptions: {expiresIn: config.get('JWT_TTL_SECONDS', {infer: true})},
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {
}
