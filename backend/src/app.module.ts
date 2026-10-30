import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { BalancesModule } from './balances/balances.module.js';
import { validateEnv } from './config/env.js';
import { loggerConfig } from './config/logger.config.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({ inject: [ConfigService], useFactory: loggerConfig }),
    DatabaseModule,
    AuthModule,
    BalancesModule,
    WebhooksModule,
    HealthModule,
  ],
})
export class AppModule {}
