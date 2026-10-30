import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApi } from '../../test/mockApi'
import { OperationForm } from './OperationForm'

const RESULT = {
  transaction: { id: 1, type: 'DEPOSIT', amount: '25.50', currency: 'USD', balanceAfter: '25.50', createdAt: '' },
  balance: { userId: 'u_123', amount: '25.50', currency: 'USD', updatedAt: '' },
}

describe('OperationForm', () => {
  it('valida el monto antes de enviarlo', async () => {
    const fetchSpy = mockApi({})
    render(<OperationForm onCompleted={vi.fn()} />)
    await userEvent.type(screen.getByLabelText(/Monto/), '1.999')
    await userEvent.click(screen.getByRole('button', { name: 'Depositar' }))

    expect(screen.getByRole('alert')).toHaveTextContent('máximo 2 decimales')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('deshabilita el botón mientras envía y usa Idempotency-Key', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => (release = resolve))
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      await pending
      return new Response(JSON.stringify(RESULT), { status: 201 })
    })
    const onCompleted = vi.fn()
    render(<OperationForm onCompleted={onCompleted} />)

    await userEvent.type(screen.getByLabelText(/Monto/), '25,50')
    await userEvent.click(screen.getByRole('button', { name: 'Depositar' }))

    expect(screen.getByRole('button', { name: 'Procesando…' })).toBeDisabled()
    const [url, init] = fetchSpy.mock.calls[0]
    const request = init!
    expect(url).toBe('/api/balances/me/deposits')
    expect(JSON.parse(String(request.body))).toEqual({ amount: '25.50', currency: 'USD' })
    expect((request.headers as Record<string, string>)['Idempotency-Key']).toBeTruthy()

    release()
    expect(await screen.findByText('Depósito realizado: $25.50.')).toBeInTheDocument()
    expect(onCompleted).toHaveBeenCalled()
  })

  it('muestra el error de saldo insuficiente de la API', async () => {
    mockApi({
      'POST /balances/me/withdrawals': {
        status: 422,
        body: { statusCode: 422, code: 'INSUFFICIENT_FUNDS', message: 'x' },
      },
    })
    render(<OperationForm onCompleted={vi.fn()} />)
    await userEvent.click(screen.getByText('Retirar'))
    await userEvent.type(screen.getByLabelText(/Monto/), '500')
    await userEvent.click(screen.getByRole('button', { name: 'Retirar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes saldo suficiente')
  })
})
