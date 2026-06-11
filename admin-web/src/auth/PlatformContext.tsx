import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  enterTenantImpersonation,
  exitTenantImpersonation,
} from '../api/platform/impersonation'
import { useAuth } from './useAuth'
import { PlatformContext } from './platform-context'
import {
  clearImpersonationSession,
  loadStoredSession,
  persistImpersonationSession,
} from './storage'

const ROLE_RANK: Record<string, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
}

export function PlatformProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { platformRole, updateAccessToken } = useAuth()
  const [sessionVersion, setSessionVersion] = useState(0)
  const [isEntering, setIsEntering] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  const { isImpersonating, impersonatedTenantName } = useMemo(() => {
    if (!platformRole) {
      return { isImpersonating: false, impersonatedTenantName: null }
    }
    const stored = loadStoredSession()
    return {
      isImpersonating: stored.isImpersonating,
      impersonatedTenantName: stored.impersonatedTenantName,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bust on impersonation
  }, [platformRole, sessionVersion])

  const rank = platformRole ? (ROLE_RANK[platformRole] ?? 0) : 0

  const enterTenant = useCallback(
    async (tenantId: string) => {
      if (!platformRole || rank < ROLE_RANK.operator) {
        throw new Error('Sem permissão para entrar no município.')
      }
      setIsEntering(true)
      try {
        const data = await enterTenantImpersonation(tenantId)
        persistImpersonationSession(
          data.accessToken,
          data.refreshToken,
          data.tenant
        )
        updateAccessToken(data.accessToken)
        setSessionVersion((v) => v + 1)
        navigate('/admin', { replace: true })
      } finally {
        setIsEntering(false)
      }
    },
    [navigate, platformRole, rank, updateAccessToken]
  )

  const exitImpersonation = useCallback(async () => {
    setIsExiting(true)
    try {
      const data = await exitTenantImpersonation()
      clearImpersonationSession(data.accessToken, data.refreshToken)
      updateAccessToken(data.accessToken)
      setSessionVersion((v) => v + 1)
      navigate('/platform', { replace: true })
    } finally {
      setIsExiting(false)
    }
  }, [navigate, updateAccessToken])

  const value = useMemo(
    () => ({
      platformRole,
      isPlatformStaff: Boolean(platformRole),
      isImpersonating,
      impersonatedTenantName,
      canOperate: rank >= ROLE_RANK.operator,
      canAdmin: rank >= ROLE_RANK.admin,
      enterTenant,
      exitImpersonation,
      isEntering,
      isExiting,
    }),
    [
      platformRole,
      isImpersonating,
      impersonatedTenantName,
      rank,
      enterTenant,
      exitImpersonation,
      isEntering,
      isExiting,
    ]
  )

  return (
    <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>
  )
}
