import { useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { Alert } from '../../components/Alert'
import { useAuth } from './useAuth'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Agrega al mensaje los intentos restantes o el tiempo de espera del bloqueo. */
function loginErrorMessage(error: ApiError): string {
  const details = (error.details ?? {}) as { remainingAttempts?: number; retryAfterSeconds?: number }
  if (error.code === 'INVALID_CREDENTIALS' && details.remainingAttempts) {
    const n = details.remainingAttempts
    return `${error.message} ${n === 1 ? 'Te queda 1 intento.' : `Te quedan ${n} intentos.`}`
  }
  if (error.code === 'TOO_MANY_LOGIN_ATTEMPTS' && details.retryAfterSeconds) {
    const minutes = Math.ceil(details.retryAfterSeconds / 60)
    return `${error.message} Intenta de nuevo en ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`
  }
  return error.message
}

export function LoginPage() {
  const { login, notice } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!EMAIL_PATTERN.test(email.trim())) return setError('Ingresa un email válido.')
    if (!password) return setError('Ingresa tu contraseña.')

    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      setError(err instanceof ApiError ? loginErrorMessage(err) : 'Ocurrió un error inesperado.')
      setSubmitting(false)
    }
  }

  return (
    <main className="page page--center">
      <form className="card login" onSubmit={handleSubmit} noValidate>
        <h1>Orbita</h1>
        <p className="muted">Inicia sesión para ver tu saldo.</p>

        {notice && !error && <Alert kind="info">{notice}</Alert>}
        {error && <Alert kind="error">{error}</Alert>}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />
        </label>
        <button className="button" type="submit" disabled={submitting}>
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  )
}
