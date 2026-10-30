import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { createOperation } from '../../api/orbita'
import type { OperationKind } from '../../api/orbita'
import { Alert } from '../../components/Alert'
import { newIdempotencyKey } from '../../lib/id'
import { formatUsd, normalizeAmount, validateAmount } from '../../lib/money'

const LABELS: Record<OperationKind, { action: string; done: string }> = {
  deposits: { action: 'Depositar', done: 'Depósito realizado' },
  withdrawals: { action: 'Retirar', done: 'Retiro realizado' },
}

export function OperationForm({ onCompleted }: { onCompleted: () => void }) {
  const [kind, setKind] = useState<OperationKind>('deposits')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  // Se conserva si falla la red: reintentar la misma operación no la duplica.
  const pendingKey = useRef<string | null>(null)

  function resetFeedback() {
    pendingKey.current = null
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const validation = validateAmount(amount)
    if (validation) {
      setSuccess(null)
      return setError(validation)
    }

    const value = normalizeAmount(amount)
    pendingKey.current ??= newIdempotencyKey()
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await createOperation(kind, value, pendingKey.current)
      pendingKey.current = null
      setAmount('')
      setSuccess(`${LABELS[kind].done}: ${formatUsd(result.transaction.amount)}.`)
      onCompleted()
    } catch (err) {
      if (!(err instanceof ApiError)) return setError('Ocurrió un error inesperado.')
      if (err.code !== 'NETWORK_ERROR') pendingKey.current = null
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="card" aria-labelledby="operation-title">
      <h2 id="operation-title" className="card__title">Nueva operación</h2>
      <form onSubmit={handleSubmit} noValidate>
        <div className="segmented" role="radiogroup" aria-label="Tipo de operación">
          {(Object.keys(LABELS) as OperationKind[]).map((option) => (
            <label key={option} className={option === kind ? 'segmented__item is-active' : 'segmented__item'}>
              <input
                type="radio"
                name="kind"
                value={option}
                checked={option === kind}
                disabled={submitting}
                onChange={() => {
                  setKind(option)
                  resetFeedback()
                }}
              />
              {LABELS[option].action}
            </label>
          ))}
        </div>

        <label className="field">
          <span>Monto (USD)</span>
          <input
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            disabled={submitting}
            aria-invalid={Boolean(error)}
            onChange={(e) => {
              setAmount(e.target.value)
              resetFeedback()
            }}
          />
          <small className="muted">Máximo 10,000 USD, hasta 2 decimales.</small>
        </label>

        {error && <Alert kind="error">{error}</Alert>}
        {success && <Alert kind="success">{success}</Alert>}

        <button className="button" type="submit" disabled={submitting}>
          {submitting ? 'Procesando…' : LABELS[kind].action}
        </button>
      </form>
    </section>
  )
}
