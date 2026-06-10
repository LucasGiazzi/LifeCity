import type { AdminUser, TenantSummary } from '../api/auth'

const ACCESS = 'lifecity_admin_accessToken'
const REFRESH = 'lifecity_admin_refreshToken'
const USER = 'lifecity_admin_user'
const TENANTS = 'lifecity_admin_tenants'
const ACTIVE_TENANT = 'lifecity_admin_activeTenantId'

export function loadStoredSession(): {
  accessToken: string | null
  refreshToken: string | null
  user: AdminUser | null
  tenants: TenantSummary[]
  activeTenantId: string | null
} {
  try {
    const accessToken = sessionStorage.getItem(ACCESS)
    const refreshToken = sessionStorage.getItem(REFRESH)
    const raw = sessionStorage.getItem(USER)
    if (!accessToken || !raw) {
      return {
        accessToken: null,
        refreshToken: null,
        user: null,
        tenants: [],
        activeTenantId: null,
      }
    }
    const parsed = JSON.parse(raw) as AdminUser
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.user_level !== 'number' ||
      typeof parsed.email !== 'string'
    ) {
      return {
        accessToken: null,
        refreshToken: null,
        user: null,
        tenants: [],
        activeTenantId: null,
      }
    }
    const tenantsRaw = sessionStorage.getItem(TENANTS)
    const tenants = tenantsRaw ? (JSON.parse(tenantsRaw) as TenantSummary[]) : []
    const activeTenantId = sessionStorage.getItem(ACTIVE_TENANT)

    return {
      accessToken,
      refreshToken,
      user: { ...parsed, user_level: Number(parsed.user_level) },
      tenants,
      activeTenantId,
    }
  } catch {
    return {
      accessToken: null,
      refreshToken: null,
      user: null,
      tenants: [],
      activeTenantId: null,
    }
  }
}

export function persistSession(
  accessToken: string,
  refreshToken: string,
  user: AdminUser,
  tenants: TenantSummary[] = [],
  activeTenantId?: string | null
): void {
  sessionStorage.setItem(ACCESS, accessToken)
  sessionStorage.setItem(REFRESH, refreshToken)
  sessionStorage.setItem(USER, JSON.stringify(user))
  sessionStorage.setItem(TENANTS, JSON.stringify(tenants))
  if (activeTenantId) {
    sessionStorage.setItem(ACTIVE_TENANT, activeTenantId)
  } else {
    sessionStorage.removeItem(ACTIVE_TENANT)
  }
}

export function persistAccessToken(accessToken: string): void {
  sessionStorage.setItem(ACCESS, accessToken)
}

export function persistTenantSession(
  tenants: TenantSummary[],
  activeTenantId: string | null
): void {
  sessionStorage.setItem(TENANTS, JSON.stringify(tenants))
  if (activeTenantId) {
    sessionStorage.setItem(ACTIVE_TENANT, activeTenantId)
  } else {
    sessionStorage.removeItem(ACTIVE_TENANT)
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(ACCESS)
  sessionStorage.removeItem(REFRESH)
  sessionStorage.removeItem(USER)
  sessionStorage.removeItem(TENANTS)
  sessionStorage.removeItem(ACTIVE_TENANT)
}
