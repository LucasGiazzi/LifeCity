import { createContext } from 'react'
import type { AdminUser, PlatformRole, TenantSummary } from '../api/auth'

export type SessionPayload = {
  accessToken: string
  refreshToken: string
  user: AdminUser
  tenants?: TenantSummary[]
  activeTenantId?: string | null
  platformRole?: PlatformRole | null
}

export type AuthContextValue = {
  accessToken: string | null
  user: AdminUser | null
  platformRole: PlatformRole | null
  /** Gate: platformRole ou membership municipal ativa. */
  canAccessAdmin: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<'platform' | 'admin'>
  applySession: (data: SessionPayload) => void
  logout: () => void
  setUserFromMe: (user: AdminUser) => void
  updateAccessToken: (token: string) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
