import type { TransactionType } from '../../database/schema.js';

export class BalanceDto {
  userId: string;
  /** @example "150.25" */
  amount: string;
  currency: string;
  updatedAt: string;
}

export class TransactionDto {
  id: number;
  type: TransactionType;
  amount: string;
  currency: string;
  balanceAfter: string;
  createdAt: string;
}

export class OperationResultDto {
  transaction: TransactionDto;
  balance: BalanceDto;
}

export class PaginationDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class TransactionPageDto {
  data: TransactionDto[];
  pagination: PaginationDto;
}
