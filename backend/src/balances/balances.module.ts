import { Module } from '@nestjs/common';
import { BalancesController } from './balances.controller.js';
import { BalancesService } from './balances.service.js';
import { LedgerService } from './ledger.service.js';

@Module({
  controllers: [BalancesController],
  providers: [BalancesService, LedgerService],
  exports: [LedgerService],
})
export class BalancesModule {}
