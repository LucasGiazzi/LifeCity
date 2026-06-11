import { createContext } from 'react'
import type { PlatformRole } from '../api/auth'

export type PlatformContextValue = {
  platformRole: PlatformRole | null
  isPlatformStaff: boolean
  isImpersonating: boolean
  impersonatedTenantName: string | null
  canOperate: boolean
  canAdmin: boolean
  enterTenant: (tenantId: string) => Promise<void>
  exitImpersonation: () => Promise<void>
  isEntering: boolean
  isExiting: boolean
}

export const PlatformContext = createContext<PlatformContextValue | null>(null)
