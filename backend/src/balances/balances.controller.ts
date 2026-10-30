import { Body, Controller, Get, Headers, Post, Query, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthUser } from '../common/auth-user.js';
import { BalancesService, Operation } from './balances.service.js';
import {
  BalanceDto,
  OperationResultDto,
  TransactionPageDto,
} from './dto/balance-responses.dto.js';
import { ListTransactionsQuery } from './dto/list-transactions.query.js';
import { OperationDto } from './dto/operation.dto.js';

const IDEMPOTENCY_HEADER = {
  name: 'Idempotency-Key',
  required: true,
  description: 'Identificador único de la operación (p. ej. un UUID)',
};

@ApiTags('balances')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'MISSING_TOKEN | INVALID_TOKEN | TOKEN_EXPIRED' })
@UseGuards(JwtAuthGuard)
@Controller('balances/me')
export class BalancesController {
  constructor(private readonly balances: BalancesService) {}

  @Get()
  @ApiOperation({ summary: 'Saldo actual (se crea en 0 si no existe)' })
  @ApiOkResponse({ type: BalanceDto })
  getBalance(@CurrentUser() user: AuthUser): BalanceDto {
    return this.balances.getBalance(user.id);
  }

  @Post('deposits')
  @ApiOperation({ summary: 'Acredita un depósito de inmediato' })
  @ApiHeader(IDEMPOTENCY_HEADER)
  @ApiCreatedResponse({ type: OperationResultDto })
  @ApiConflictResponse({ description: 'IDEMPOTENCY_KEY_REUSED' })
  deposit(
    @CurrentUser() user: AuthUser,
    @Body() dto: OperationDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): OperationResultDto {
    return this.operate(user, 'DEPOSIT', dto, key, res);
  }

  @Post('withdrawals')
  @ApiOperation({ summary: 'Retira saldo (nunca queda negativo)' })
  @ApiHeader(IDEMPOTENCY_HEADER)
  @ApiCreatedResponse({ type: OperationResultDto })
  @ApiConflictResponse({ description: 'IDEMPOTENCY_KEY_REUSED' })
  @ApiUnprocessableEntityResponse({ description: 'INSUFFICIENT_FUNDS' })
  withdraw(
    @CurrentUser() user: AuthUser,
    @Body() dto: OperationDto,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): OperationResultDto {
    return this.operate(user, 'WITHDRAWAL', dto, key, res);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Movimientos del más reciente al más antiguo' })
  @ApiOkResponse({ type: TransactionPageDto })
  listTransactions(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTransactionsQuery,
  ): TransactionPageDto {
    return this.balances.listTransactions(user.id, query.page, query.limit);
  }

  private operate(
    user: AuthUser,
    operation: Operation,
    dto: OperationDto,
    key: string | undefined,
    res: Response,
  ): OperationResultDto {
    const { body, replayed } = this.balances.operate(user.id, operation, dto, key);
    res.setHeader('Idempotent-Replayed', String(replayed));
    return body;
  }
}
