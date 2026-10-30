export const MAX_AMOUNT = 10_000

const AMOUNT_PATTERN = /^\d{1,7}(\.\d{1,2})?$/

/** Normaliza lo que escribe el usuario: quita espacios y acepta coma decimal. */
export function normalizeAmount(input: string): string {
  return input.trim().replace(',', '.')
}

/** Mismas reglas que la API. Devuelve el mensaje de error o null si es válido. */
export function validateAmount(input: string): string | null {
  const value = normalizeAmount(input)
  if (!value) return 'Ingresa un monto.'
  if (!AMOUNT_PATTERN.test(value)) return 'Usa solo números, con máximo 2 decimales (ej. 150.25).'
  const amount = Number(value)
  if (amount <= 0) return 'El monto debe ser mayor que 0.'
  if (amount > MAX_AMOUNT) return 'El monto máximo por operación es 10,000 USD.'
  return null
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function formatUsd(amount: string): string {
  return usd.format(Number(amount))
}
