import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { readSession, saveSession } from './lib/session'
import { BALANCE, EMPTY_PAGE, mockApi, SESSION } from './test/mockApi'

async function fillLogin(email: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Contraseña'), password)
  await user.click(screen.getByRole('button', { name: 'Ingresar' }))
}

describe('Login', () => {
  it('muestra un mensaje entendible si las credenciales no son válidas', async () => {
    mockApi({
      'POST /auth/login': { status: 401, body: { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'x' } },
    })
    render(<App />)
    await fillLogin('ana@orbita.test', 'mala')
    expect(await screen.findByRole('alert')).toHaveTextContent('El email o la contraseña no son correctos.')
    expect(readSession()).toBeNull()
  })

  it('valida el email antes de enviar', async () => {
    const fetchSpy = mockApi({})
    render(<App />)
    await fillLogin('no-es-email', 'x')
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresa un email válido.')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('guarda la sesión en cookie y envía el token Bearer en las peticiones', async () => {
    const fetchSpy = mockApi({
      'POST /auth/login': { status: 200, body: SESSION },
      'GET /balances/me': { status: 200, body: BALANCE },
      'GET /balances/me/transactions': { status: 200, body: EMPTY_PAGE },
    })
    render(<App />)
    await fillLogin('ana@orbita.test', 'Orbita123!')

    expect(await screen.findByTestId('balance-amount')).toHaveTextContent('$150.25')
    expect(await screen.findByText('Aún no tienes movimientos.')).toBeInTheDocument()
    expect(readSession()?.accessToken).toBe('token-123')

    const balanceCall = fetchSpy.mock.calls.find(([url]) => String(url) === '/api/balances/me')!
    const headers = balanceCall[1]!.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token-123')
  })
})

describe('Sesión', () => {
  it('se conserva al recargar y se puede cerrar', async () => {
    saveSession(SESSION)
    mockApi({
      'GET /balances/me': { status: 200, body: BALANCE },
      'GET /balances/me/transactions': { status: 200, body: EMPTY_PAGE },
    })
    render(<App />)
    expect(await screen.findByTestId('balance-amount')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
    expect(readSession()).toBeNull()
  })

  it('si la API responde 401 vuelve al login y explica por qué', async () => {
    saveSession(SESSION)
    const expired = { status: 401, body: { statusCode: 401, code: 'TOKEN_EXPIRED', message: 'x' } }
    mockApi({ 'GET /balances/me': expired, 'GET /balances/me/transactions': expired })
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Tu sesión expiró. Inicia sesión de nuevo.')
    expect(readSession()).toBeNull()
  })

  it('un token vencido guardado en la cookie lleva al login con el motivo', () => {
    saveSession({ ...SESSION, expiresAt: new Date(Date.now() - 1000).toISOString() })
    render(<App />)
    expect(screen.getByRole('status')).toHaveTextContent('Tu sesión expiró.')
  })
})
