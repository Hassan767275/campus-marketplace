import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, setUnauthorizedHandler } from '../api/client'
import * as authApi from './authApi'
import { clearToken, getToken, setToken } from './session'
import { AuthContext, type AuthContextValue, type AuthState } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  // With a stored token we don't know who the user is until /me answers.
  const [state, setState] = useState<AuthState>(() =>
    getToken() ? { status: 'loading', user: null } : { status: 'anonymous', user: null },
  )

  const logout = useCallback(() => {
    clearToken()
    setState({ status: 'anonymous', user: null })
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  useEffect(() => {
    if (!getToken()) return
    const controller = new AbortController()
    authApi
      .fetchMe(controller.signal)
      .then(({ user }) => setState({ status: 'authenticated', user }))
      .catch((err) => {
        if (controller.signal.aborted) return
        // A 401 already cleared the session via the unauthorized handler. For other failures
        // (server down) keep the token so a reload can recover, but treat the user as logged out.
        if (!(err instanceof ApiError && err.status === 401)) setState({ status: 'anonymous', user: null })
      })
    return () => controller.abort()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await authApi.login(email, password)
    setToken(token)
    setState({ status: 'authenticated', user })
    return user
  }, [])

  const value = useMemo<AuthContextValue>(() => ({ ...state, login, logout }), [state, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
