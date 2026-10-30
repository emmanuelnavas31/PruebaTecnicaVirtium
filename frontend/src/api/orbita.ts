import type { Session } from '../lib/session'
import { apiRequest } from './client'

export interface Balance {
  userId: string
  amount: string
  currency: string
  updatedAt: string
}

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'GATEWAY_CREDIT'

export interface Transaction {
  id: number
  type: TransactionType
  amount: string
  currency: string
  balanceAfter: string
  createdAt: string
}

export interface TransactionPage {
  data: Transaction[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface OperationResult {
  transaction: Transaction
  balance: Balance
}

export type OperationKind = 'deposits' | 'withdrawals'

export const login = (email: string, password: string) =>
  apiRequest<Session>('/auth/login', { method: 'POST', body: { email, password }, auth: false })

export const getBalance = () => apiRequest<Balance>('/balances/me')

export const listTransactions = (page: number, limit = 10) =>
  apiRequest<TransactionPage>(`/balances/me/transactions?page=${page}&limit=${limit}`)

export const createOperation = (kind: OperationKind, amount: string, idempotencyKey: string) =>
  apiRequest<OperationResult>(`/balances/me/${kind}`, {
    method: 'POST',
    body: { amount, currency: 'USD' },
    headers: { 'Idempotency-Key': idempotencyKey },
  })
