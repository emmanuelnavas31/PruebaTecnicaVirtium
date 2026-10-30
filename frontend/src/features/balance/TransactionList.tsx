import { Alert } from '../../components/Alert'
import { formatUsd } from '../../lib/money'
import type { TransactionPage, TransactionType } from '../../api/orbita'

const TYPE_LABELS: Record<TransactionType, string> = {
  DEPOSIT: 'Depósito',
  WITHDRAWAL: 'Retiro',
  GATEWAY_CREDIT: 'Pago aprobado',
}

const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

interface Props {
  page: TransactionPage | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onPageChange: (page: number) => void
}

export function TransactionList({ page, loading, error, onRetry, onPageChange }: Props) {
  const current = page?.pagination.page ?? 1
  const totalPages = page?.pagination.totalPages ?? 0

  return (
    <section className="card" aria-labelledby="history-title">
      <h2 id="history-title" className="card__title">Movimientos</h2>

      {error ? (
        <Alert kind="error">
          {error}{' '}
          <button className="link" onClick={onRetry}>
            Reintentar
          </button>
        </Alert>
      ) : loading && !page ? (
        <p className="muted" aria-busy="true">Cargando movimientos…</p>
      ) : page && page.data.length === 0 ? (
        <p className="empty">Aún no tienes movimientos.</p>
      ) : (
        page && (
          <ul className={loading ? 'transactions is-loading' : 'transactions'}>
            {page.data.map((tx) => {
              const outgoing = tx.type === 'WITHDRAWAL'
              return (
                <li key={tx.id} className="transaction">
                  <div>
                    <strong>{TYPE_LABELS[tx.type]}</strong>
                    <span className="muted">{dateFormat.format(new Date(tx.createdAt))}</span>
                  </div>
                  <div className="transaction__amounts">
                    <strong className={outgoing ? 'negative' : 'positive'}>
                      {outgoing ? '−' : '+'}
                      {formatUsd(tx.amount)}
                    </strong>
                    <span className="muted">Saldo: {formatUsd(tx.balanceAfter)}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )
      )}

      {totalPages > 1 && (
        <nav className="pagination" aria-label="Paginación">
          <button className="button button--ghost" disabled={loading || current <= 1} onClick={() => onPageChange(current - 1)}>
            Anterior
          </button>
          <span className="muted">
            Página {current} de {totalPages}
          </span>
          <button
            className="button button--ghost"
            disabled={loading || current >= totalPages}
            onClick={() => onPageChange(current + 1)}
          >
            Siguiente
          </button>
        </nav>
      )}
    </section>
  )
}
