export interface Session {
  accessToken: string
  tokenType: 'Bearer'
  expiresAt: string
  user: { id: string; email: string }
}

const COOKIE_NAME = 'orbita_session'
// La cookie dura un poco más que el token: así, al recargar con el token
// vencido, todavía podemos explicarle al usuario que su sesión expiró.
const GRACE_MS = 12 * 60 * 60 * 1000

export function saveSession(session: Session): void {
  const expires = new Date(new Date(session.expiresAt).getTime() + GRACE_MS)
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie =
    `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(session))}` +
    `; Expires=${expires.toUTCString()}; Path=/; SameSite=Strict${secure}`
}

export function readSession(): Session | null {
  const raw = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1)
  if (!raw) return null
  try {
    const session = JSON.parse(decodeURIComponent(raw)) as Session
    return session.accessToken && session.expiresAt && session.user ? session : null
  } catch {
    return null
  }
}

export function clearSession(): void {
  document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Strict`
}

export function isExpired(session: Session, now = Date.now()): boolean {
  return new Date(session.expiresAt).getTime() <= now
}
