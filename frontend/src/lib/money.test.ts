import { formatUsd, validateAmount } from './money'

describe('validateAmount', () => {
  it.each(['150.25', '0.01', '10000', '10000.00', ' 25,5 '])('acepta %s', (value) => {
    expect(validateAmount(value)).toBeNull()
  })

  it.each([
    ['', 'Ingresa un monto'],
    ['abc', '2 decimales'],
    ['1.234', '2 decimales'],
    ['-5', '2 decimales'],
    ['0', 'mayor que 0'],
    ['10000.01', '10,000'],
  ])('rechaza "%s"', (value, message) => {
    expect(validateAmount(value)).toContain(message)
  })
})

it('formatUsd', () => {
  expect(formatUsd('1500.5')).toBe('$1,500.50')
})
