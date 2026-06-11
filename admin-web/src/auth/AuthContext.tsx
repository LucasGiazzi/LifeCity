import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AdminUser, PlatformRole, TenantSummary } from '../api/auth'
import type { SessionPayload } from './auth-context'
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
  const [platformRole, setPlatformRole] = useState<PlatformRole | null>(
    initial.platformRole
  )
  const [tenants, setTenants] = useState<TenantSummary[]>(initial.tenants)
  const [isLoading, setIsLoading] = useState(false)

  const canAccessAdmin = Boolean(
    user && (platformRole || tenants.length > 0)
  )

  const logout = useCallback(() => {
    clearSession()
    setAccessToken(null)
    setRefreshToken(null)
    setUser(null)
    setPlatformRole(null)
    setTenants([])
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

  const applySession = useCallback((data: SessionPayload) => {
    const tenants = data.tenants ?? []
    const role = data.platformRole ?? null
    const safeUser = stripUserForStorage({
      ...data.user,
      user_level: Number(data.user.user_level ?? 1),
    })
    persistSession(
      data.accessToken,
      data.refreshToken,
      safeUser,
      tenants,
      data.activeTenantId ?? null,
      role
    )
    setAccessToken(data.accessToken)
    setRefreshToken(data.refreshToken)
    setUser(safeUser)
    setPlatformRole(role)
    setTenants(tenants)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const data = await loginRequest(email.trim(), password)
      const tenants = data.tenants ?? []
      const role = data.platformRole ?? null

      if (!role && tenants.length === 0) {
        throw new Error('Sem permissão para aceder ao painel.')
      }

      applySession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: {
          ...data.user,
          user_level: Number(data.user.user_level ?? 1),
        },
        tenants,
        activeTenantId: data.activeTenantId ?? null,
        platformRole: role,
      })
      return role ? 'platform' : 'admin'
    } finally {
      setIsLoading(false)
    }
  }, [applySession])

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
        stored.activeTenantId,
        stored.platformRole
      )
      setUser(safe)
    },
    [accessToken, refreshToken]
  )

  const value = useMemo(
    () => ({
      accessToken,
      user,
      platformRole,
      canAccessAdmin,
      isLoading,
      login,
      applySession,
      logout,
      setUserFromMe,
      updateAccessToken,
    }),
    [
      accessToken,
      user,
      platformRole,
      canAccessAdmin,
      isLoading,
      login,
      applySession,
      logout,
      setUserFromMe,
      updateAccessToken,
    ]
  )

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}
