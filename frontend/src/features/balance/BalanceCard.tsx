import { Alert } from '../../components/Alert'
import { formatUsd } from '../../lib/money'
import type { Balance } from '../../api/orbita'

interface Props {
  balance: Balance | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

export function BalanceCard({ balance, loading, error, onRetry }: Props) {
  return (
    <section className="card" aria-labelledby="balance-title">
      <h2 id="balance-title" className="card__title">Saldo disponible</h2>
      {error ? (
        <Alert kind="error">
          {error}{' '}
          <button className="link" onClick={onRetry}>
            Reintentar
          </button>
        </Alert>
      ) : loading && !balance ? (
        <p className="balance balance--loading" aria-busy="true">Cargando…</p>
      ) : (
        balance && (
          <p className="balance" data-testid="balance-amount">
            {formatUsd(balance.amount)} <span className="muted">{balance.currency}</span>
          </p>
        )
      )}
    </section>
  )
}
