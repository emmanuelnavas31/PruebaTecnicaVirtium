import { createContext, useContext } from 'react'
import type { Session } from '../../lib/session'

export interface AuthContextValue {
  session: Session | null
  /** Motivo por el que se cerró la sesión, para mostrarlo en el login. */
  notice: string | null
  login: (email: string, password: string) => Promise<void>
  logout: (notice?: string) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return context
}
