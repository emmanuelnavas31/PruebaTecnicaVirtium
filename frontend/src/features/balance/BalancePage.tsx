import { useCallback, useState } from 'react'
import { getBalance, listTransactions } from '../../api/orbita'
import { useAsync } from '../../components/useAsync'
import { useAuth } from '../auth/useAuth'
import { BalanceCard } from './BalanceCard'
import { OperationForm } from './OperationForm'
import { TransactionList } from './TransactionList'

const PAGE_SIZE = 10

export function BalancePage() {
  const { session, logout } = useAuth()
  const [page, setPage] = useState(1)

  const balance = useAsync(getBalance)
  const loadTransactions = useCallback(() => listTransactions(page, PAGE_SIZE), [page])
  const transactions = useAsync(loadTransactions)

  const refresh = () => {
    balance.reload()
    if (page === 1) transactions.reload()
    else setPage(1)
  }

  return (
    <div className="page">
      <header className="topbar">
        <strong>Orbita</strong>
        <div className="topbar__user">
          <span className="muted">{session?.user.email}</span>
          <button className="button button--ghost" onClick={() => logout()}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="layout__side">
          <BalanceCard
            balance={balance.data}
            loading={balance.loading}
            error={balance.error}
            onRetry={balance.reload}
          />
          <OperationForm onCompleted={refresh} />
        </div>
        <TransactionList
          page={transactions.data}
          loading={transactions.loading}
          error={transactions.error}
          onRetry={transactions.reload}
          onPageChange={setPage}
        />
      </main>
    </div>
  )
}
