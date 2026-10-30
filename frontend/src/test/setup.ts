import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { clearSession } from '../lib/session'

afterEach(() => {
  cleanup()
  clearSession()
  vi.restoreAllMocks()
})
