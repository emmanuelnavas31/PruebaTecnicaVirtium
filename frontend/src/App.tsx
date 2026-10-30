import { AuthProvider } from './features/auth/AuthContext'
import { useAuth } from './features/auth/useAuth'
import { BalancePage } from './features/balance/BalancePage'
import { LoginPage } from './features/auth/LoginPage'

function Screen() {
  const { session } = useAuth()
  return session ? <BalancePage /> : <LoginPage />
}

export default function App() {
  return (
    <AuthProvider>
      <Screen />
    </AuthProvider>
  )
}
