import { readSession } from '../lib/session'
import { messageFor } from './errors'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, details?: unknown) {
    super(messageFor(code, status))
    this.status = status
    this.code = code
    this.details = details
  }
}

let unauthorizedHandler: ((error: ApiError) => void) | null = null

/** La app registra aquí qué hacer cuando la API responde 401 (volver al login). */
export function onUnauthorized(handler: ((error: ApiError) => void) | null): void {
  unauthorizedHandler = handler
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  headers?: Record<string, string>
  /** false para el login: no envía token ni dispara el cierre de sesión. */
  auth?: boolean
}

/** Todas las peticiones pasan por aquí: envían `Authorization: Bearer <token>`. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, auth = true } = options
  const finalHeaders: Record<string, string> = { Accept: 'application/json', ...headers }
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json'

  const session = auth ? readSession() : null
  if (session) finalHeaders.Authorization = `${session.tokenType} ${session.accessToken}`

  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR')
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new ApiError(response.status, data?.code ?? 'HTTP_ERROR', data?.details)
    if (response.status === 401 && auth) unauthorizedHandler?.(error)
    throw error
  }
  return data as T
}
