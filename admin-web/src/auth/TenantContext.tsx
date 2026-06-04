import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { TenantSummary } from '../api/auth'
import { switchTenantRequest } from '../api/admin/tenants'
import { useAuth } from './useAuth'
import { TenantContext } from './tenant-context'
import {
  loadStoredSession,
  persistAccessToken,
  persistTenantSession,
} from './storage'

export function TenantProvider({ children }: { children: ReactNode }) {
  const { accessToken, updateAccessToken } = useAuth()
  const [isSwitching, setIsSwitching] = useState(false)
  const [sessionVersion, setSessionVersion] = useState(0)

  const { tenants, activeTenantId } = useMemo(() => {
    if (!accessToken) {
      return { tenants: [] as TenantSummary[], activeTenantId: null as string | null }
    }
    const stored = loadStoredSession()
    return {
      tenants: stored.tenants,
      activeTenantId: stored.activeTenantId,
    }
    // sessionVersion força releitura após switch de tenant
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional bust cache
  }, [accessToken, sessionVersion])

  const activeTenant = useMemo(
    () => tenants.find((t) => t.id === activeTenantId) ?? null,
    [tenants, activeTenantId]
  )

  const switchTenant = useCallback(
    async (tenantId: string) => {
      if (!accessToken) {
        throw new Error('Sessão expirada.')
      }
      setIsSwitching(true)
      try {
        const data = await switchTenantRequest(tenantId)
        updateAccessToken(data.accessToken)
        persistAccessToken(data.accessToken)
        persistTenantSession(tenants, data.activeTenantId)
        setSessionVersion((v) => v + 1)
      } finally {
        setIsSwitching(false)
      }
    },
    [accessToken, tenants, updateAccessToken]
  )

  const value = useMemo(
    () => ({
      tenants,
      activeTenantId,
      activeTenant,
      hasTenantAccess: tenants.length > 0 && Boolean(activeTenantId),
      isSwitching,
      switchTenant,
    }),
    [tenants, activeTenantId, activeTenant, isSwitching, switchTenant]
  )

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  )
}
