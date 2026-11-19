import { createContext, useContext } from 'react'
import type { Credentials, LoginResponse, User } from '../api/auth'

// saved login (sessionStorage)

const STORAGE_KEY = 'radiomics.session'

export function readSession(): LoginResponse | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LoginResponse) : null
  } catch {
    return null
  }
}

export function writeSession(session: LoginResponse) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY)
}

export const SESSION_EXPIRED_EVENT = 'radiomics:session-expired'

export function expireSession() {
  clearSession()
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}

export function getToken(): string | null {
  return readSession()?.token ?? null
}

// shared login state for React components

export type AuthContextValue = {
  user: User | null
  token: string | null
  login: (credentials: Credentials) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
