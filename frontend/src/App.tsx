import { useEffect, useState } from 'react'

type ApiStatus = 'loading' | 'ok' | 'error'

// Placeholder del paso 1: verifica la integración front → API.
function App() {
  const [status, setStatus] = useState<ApiStatus>('loading')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => setStatus(res.ok ? 'ok' : 'error'))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <main style={{ padding: 16 }}>
      <h1>Orbita</h1>
      <p>API: {status}</p>
    </main>
  )
}

export default App
