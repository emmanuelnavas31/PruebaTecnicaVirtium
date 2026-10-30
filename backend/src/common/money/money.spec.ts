import { amountError, fromCents, toCents } from './money.js';

describe('money', () => {
  it.each([
    ['150.25', 15025],
    ['150.2', 15020],
    ['150', 15000],
    ['0.01', 1],
    ['10000.00', 1_000_000],
  ])('toCents(%s) = %i', (input, cents) => {
    expect(toCents(input)).toBe(cents);
  });

  it('fromCents formatea con 2 decimales', () => {
    expect(fromCents(15025)).toBe('150.25');
    expect(fromCents(5)).toBe('0.05');
    expect(fromCents(0)).toBe('0.00');
  });

  it.each(['150.25', '0.01', '10000', '10000.00'])('acepta %s', (value) => {
    expect(amountError(value)).toBeNull();
  });

  it.each([
    [150.25, 'string'],
    ['-5', '2 decimales'],
    ['1.234', '2 decimales'],
    ['abc', '2 decimales'],
    ['0', 'mayor que 0'],
    ['0.00', 'mayor que 0'],
    ['10000.01', '10000.00'],
  ])('rechaza %s', (value, reason) => {
    expect(amountError(value)).toContain(reason);
  });
});
