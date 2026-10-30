import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { onUnauthorized } from '../../api/client'
import { messageFor } from '../../api/errors'
import { login as loginRequest } from '../../api/orbita'
import { clearSession, isExpired, readSession, saveSession } from '../../lib/session'
import type { Session } from '../../lib/session'
import { AuthContext } from './useAuth'

const EXPIRED_NOTICE = messageFor('TOKEN_EXPIRED', 401)

function initialState(): { session: Session | null; notice: string | null } {
  const stored = readSession()
  if (stored && isExpired(stored)) {
    clearSession()
    return { session: null, notice: EXPIRED_NOTICE }
  }
  return { session: stored, notice: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState)

  const logout = useCallback((notice?: string) => {
    clearSession()
    setState({ session: null, notice: notice ?? null })
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const session = await loginRequest(email, password)
    saveSession(session)
    setState({ session, notice: null })
  }, [])

  // Cualquier 401 de la API cierra la sesión y explica el motivo.
  useEffect(() => {
    onUnauthorized((error) => logout(error.message))
    return () => onUnauthorized(null)
  }, [logout])

  // Cierra la sesión justo cuando vence el token, aunque no haya peticiones.
  useEffect(() => {
    if (!state.session) return
    const ms = new Date(state.session.expiresAt).getTime() - Date.now()
    const timer = window.setTimeout(() => logout(EXPIRED_NOTICE), Math.max(ms, 0))
    return () => window.clearTimeout(timer)
  }, [state.session, logout])

  const value = useMemo(() => ({ ...state, login, logout }), [state, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
