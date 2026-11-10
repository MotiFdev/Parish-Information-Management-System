import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError, ensureCsrfCookie } from '../../lib/api'
import { AuthContext, type AuthContextValue, type AuthUser } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)

  // Pick up an existing session (e.g. after a page reload).
  useEffect(() => {
    let cancelled = false
    api<{ user: AuthUser }>('/api/auth/me')
      .then(({ user }) => {
        if (cancelled) return
        setUser(user)
        setStatus('signed-in')
      })
      .catch(() => {
        // 401 is the normal signed-out answer; a server that is down also leaves the visitor signed out.
        if (!cancelled) setStatus('signed-out')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (login: string, password: string, remember = false) => {
    const { user } = await api<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: { login, password, remember },
    })
    setUser(user)
    setStatus('signed-in')
    return user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' })
    } catch (e) {
      // Already signed out on the server: nothing left to end.
      if (!(e instanceof ApiError) || (e.status !== 401 && e.status !== 419)) throw e
    } finally {
      setUser(null)
      setStatus('signed-out')
    }
    // The session was regenerated, so the next sign-in needs a fresh token.
    await ensureCsrfCookie(true).catch(() => {})
  }, [])

  const value = useMemo(() => ({ status, user, login, logout, setUser }), [status, user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
