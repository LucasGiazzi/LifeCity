import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AdminUser } from '../api/auth'
import { loginRequest } from '../api/auth'
import { configureHttpClient } from '../api/httpClient'
import { AuthContext } from './auth-context'
import {
  clearSession,
  loadStoredSession,
  persistAccessToken,
  persistSession,
} from './storage'

function stripUserForStorage(u: AdminUser & { cpf?: unknown }): AdminUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone ?? null,
    photo_url: u.photo_url ?? null,
    birth_date: u.birth_date ?? null,
    user_level: Number(u.user_level),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = loadStoredSession()
  const [accessToken, setAccessToken] = useState<string | null>(
    initial.accessToken
  )
  const [refreshToken, setRefreshToken] = useState<string | null>(
    initial.refreshToken
  )
  const [user, setUser] = useState<AdminUser | null>(initial.user)
  const [isLoading, setIsLoading] = useState(false)

  const canAccessAdmin = Boolean(user && user.user_level > 1)

  const logout = useCallback(() => {
    clearSession()
    setAccessToken(null)
    setRefreshToken(null)
    setUser(null)
  }, [])

  const updateAccessToken = useCallback((token: string) => {
    persistAccessToken(token)
    setAccessToken(token)
  }, [])

  useEffect(() => {
    configureHttpClient({
      onAccessTokenRefreshed: updateAccessToken,
      onSessionExpired: logout,
    })
  }, [logout, updateAccessToken])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const data = await loginRequest(email.trim(), password)
      const level = Number(data.user.user_level ?? 1)
      if (level <= 1) {
        throw new Error(
          'Sem permissão para aceder ao painel administrativo.'
        )
      }
      const safeUser = stripUserForStorage({ ...data.user, user_level: level })
      const tenants = data.tenants ?? []
      persistSession(
        data.accessToken,
        data.refreshToken,
        safeUser,
        tenants,
        data.activeTenantId ?? null
      )
      setAccessToken(data.accessToken)
      setRefreshToken(data.refreshToken)
      setUser(safeUser)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const setUserFromMe = useCallback(
    (u: AdminUser) => {
      const safe = stripUserForStorage(u)
      if (!refreshToken || !accessToken) return
      const stored = loadStoredSession()
      persistSession(
        accessToken,
        refreshToken,
        safe,
        stored.tenants,
        stored.activeTenantId
      )
      setUser(safe)
    },
    [accessToken, refreshToken]
  )

  const value = useMemo(
    () => ({
      accessToken,
      user,
      canAccessAdmin,
      isLoading,
      login,
      logout,
      setUserFromMe,
      updateAccessToken,
    }),
    [
      accessToken,
      user,
      canAccessAdmin,
      isLoading,
      login,
      logout,
      setUserFromMe,
      updateAccessToken,
    ]
  )

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}
