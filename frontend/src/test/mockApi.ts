type Handler = (init: RequestInit) => { status: number; body: unknown }

/** Reemplaza fetch con respuestas por "MÉTODO /ruta" (sin el prefijo /api). */
export function mockApi(routes: Record<string, Handler | { status: number; body: unknown }>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input), 'http://localhost')
    const key = `${init.method ?? 'GET'} ${url.pathname.replace(/^\/api/, '')}`
    const route = routes[key]
    if (!route) throw new Error(`Ruta no mockeada: ${key}`)
    const { status, body } = typeof route === 'function' ? route(init) : route
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

export const SESSION = {
  accessToken: 'token-123',
  tokenType: 'Bearer' as const,
  expiresIn: 900,
  expiresAt: new Date(Date.now() + 900_000).toISOString(),
  user: { id: 'u_123', email: 'ana@orbita.test' },
}

export const BALANCE = { userId: 'u_123', amount: '150.25', currency: 'USD', updatedAt: '2026-10-30T00:00:00.000Z' }

export const EMPTY_PAGE = { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }
