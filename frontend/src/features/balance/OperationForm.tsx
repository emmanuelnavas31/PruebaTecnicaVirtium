import { useCallback, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { createOperation } from '../../api/orbita'
import type { OperationKind } from '../../api/orbita'
import { Alert } from '../../components/Alert'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { newIdempotencyKey } from '../../lib/id'
import { formatUsd, normalizeAmount, validateAmount } from '../../lib/money'

const LABELS: Record<OperationKind, { action: string; noun: string; done: string }> = {
  deposits: { action: 'Depositar', noun: 'depósito', done: 'Depósito realizado' },
  withdrawals: { action: 'Retirar', noun: 'retiro', done: 'Retiro realizado' },
}

export function OperationForm({ onCompleted }: { onCompleted: () => void }) {
  const [kind, setKind] = useState<OperationKind>('deposits')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  // Monto ya validado que espera la confirmación del usuario.
  const [toConfirm, setToConfirm] = useState<string | null>(null)
  // Se conserva si falla la red: reintentar la misma operación no la duplica.
  const pendingKey = useRef<string | null>(null)

  function resetFeedback() {
    pendingKey.current = null
    setError(null)
    setSuccess(null)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const validation = validateAmount(amount)
    setSuccess(null)
    if (validation) return setError(validation)
    setError(null)
    setToConfirm(normalizeAmount(amount))
  }

  const cancelConfirmation = useCallback(() => setToConfirm(null), [])

  async function send(value: string) {
    setToConfirm(null)
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

      {toConfirm && (
        <ConfirmDialog
          title={`Confirmar ${LABELS[kind].noun}`}
          confirmLabel={`Sí, ${LABELS[kind].action.toLowerCase()}`}
          onConfirm={() => send(toConfirm)}
          onCancel={cancelConfirmation}
        >
          <p className="dialog__text">¿Confirmas que deseas {LABELS[kind].action.toLowerCase()}?</p>
          <p className="dialog__amount">
            {formatUsd(toConfirm)} <span className="muted">USD</span>
          </p>
        </ConfirmDialog>
      )}
    </section>
  )
}
