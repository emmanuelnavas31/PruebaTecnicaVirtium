const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'El email o la contraseña no son correctos.',
  TOO_MANY_LOGIN_ATTEMPTS: 'Demasiados intentos fallidos. Por seguridad bloqueamos el acceso temporalmente.',
  MISSING_TOKEN: 'Necesitas iniciar sesión para continuar.',
  INVALID_TOKEN: 'Tu sesión no es válida. Inicia sesión de nuevo.',
  TOKEN_EXPIRED: 'Tu sesión expiró. Inicia sesión de nuevo.',
  INSUFFICIENT_FUNDS: 'No tienes saldo suficiente para este retiro.',
  IDEMPOTENCY_KEY_REUSED: 'Esta operación ya se envió con otros datos. Intenta de nuevo.',
  VALIDATION_ERROR: 'Revisa los datos ingresados.',
  NETWORK_ERROR: 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
}

export function messageFor(code: string, status: number): string {
  if (MESSAGES[code]) return MESSAGES[code]
  if (status >= 500) return 'Tuvimos un problema en el servidor. Intenta de nuevo en un momento.'
  return 'Ocurrió un error inesperado. Intenta de nuevo.'
}
