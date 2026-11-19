import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { login as loginRequest, type Credentials, type LoginResponse } from '../api/auth'
import { AuthContext, SESSION_EXPIRED_EVENT, clearSession, readSession, writeSession } from './session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LoginResponse | null>(readSession)

  const login = useCallback(async (credentials: Credentials) => {
    const result = await loginRequest(credentials)
    writeSession(result)
    setSession(result)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  useEffect(() => {
    const onExpired = () => setSession(null)
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  const value = useMemo(
    () => ({ user: session?.user ?? null, token: session?.token ?? null, login, logout }),
    [session, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
