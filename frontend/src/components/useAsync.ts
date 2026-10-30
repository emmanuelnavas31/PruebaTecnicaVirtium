import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../api/client'

interface Result<T> {
  data: T | null
  error: string | null
  /** Petición a la que corresponde este resultado. */
  request: { fn: () => Promise<T>; version: number } | null
}

/** Ejecuta una petición y expone carga, error y datos. `reload` la repite. */
export function useAsync<T>(fn: () => Promise<T>) {
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState<Result<T>>({ data: null, error: null, request: null })

  useEffect(() => {
    let active = true
    const request = { fn, version }
    fn()
      .then((data) => active && setResult({ data, error: null, request }))
      .catch((err: unknown) => {
        if (!active) return
        const error = err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.'
        setResult((prev) => ({ ...prev, error, request }))
      })
    return () => {
      active = false
    }
  }, [fn, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  // Está cargando mientras el último resultado no corresponde a la petición actual.
  const loading = result.request?.fn !== fn || result.request.version !== version
  return { data: result.data, error: loading ? null : result.error, loading, reload }
}
