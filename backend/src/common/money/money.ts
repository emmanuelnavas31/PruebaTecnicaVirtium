export const CURRENCY = 'USD';
export const MAX_AMOUNT_CENTS = 1_000_000; // 10,000.00 USD

const AMOUNT_PATTERN = /^\d{1,7}(\.\d{1,2})?$/;

/** "150.25" → 15025. Sin floats: se parte el string. */
export function toCents(amount: string): number {
  const [units, decimals = ''] = amount.split('.');
  return Number(units) * 100 + Number(decimals.padEnd(2, '0'));
}

/** 15025 → "150.25" */
export function fromCents(cents: number): string {
  const units = Math.trunc(cents / 100);
  const decimals = String(Math.abs(cents % 100)).padStart(2, '0');
  return `${units}.${decimals}`;
}

/** Devuelve el motivo por el que el monto es inválido, o null si es válido. */
export function amountError(value: unknown): string | null {
  if (typeof value !== 'string') return 'amount debe ser un string, ej. "150.25"';
  if (!AMOUNT_PATTERN.test(value)) {
    return 'amount debe ser un número positivo con máximo 2 decimales';
  }
  const cents = toCents(value);
  if (cents <= 0) return 'amount debe ser mayor que 0';
  if (cents > MAX_AMOUNT_CENTS) return 'amount no puede superar 10000.00 USD';
  return null;
}
