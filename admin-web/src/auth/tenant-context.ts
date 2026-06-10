import { createContext } from 'react'
import type { TenantSummary } from '../api/auth'

export type TenantContextValue = {
  tenants: TenantSummary[]
  activeTenantId: string | null
  activeTenant: TenantSummary | null
  hasTenantAccess: boolean
  isSwitching: boolean
  switchTenant: (tenantId: string) => Promise<void>
}

export const TenantContext = createContext<TenantContextValue | null>(null)
