import type { AdminUser, PlatformRole, TenantSummary } from '../api/auth'

const ACCESS = 'lifecity_admin_accessToken'
const REFRESH = 'lifecity_admin_refreshToken'
const USER = 'lifecity_admin_user'
const TENANTS = 'lifecity_admin_tenants'
const ACTIVE_TENANT = 'lifecity_admin_activeTenantId'
const PLATFORM_ROLE = 'lifecity_admin_platformRole'
const IS_IMPERSONATING = 'lifecity_admin_isImpersonating'
const IMPERSONATED_TENANT = 'lifecity_admin_impersonatedTenant'

export function loadStoredSession(): {
  accessToken: string | null
  refreshToken: string | null
  user: AdminUser | null
  platformRole: PlatformRole | null
  tenants: TenantSummary[]
  activeTenantId: string | null
  isImpersonating: boolean
  impersonatedTenantName: string | null
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
        platformRole: null,
        tenants: [],
        activeTenantId: null,
        isImpersonating: false,
        impersonatedTenantName: null,
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
        platformRole: null,
        tenants: [],
        activeTenantId: null,
        isImpersonating: false,
        impersonatedTenantName: null,
      }
    }
    const tenantsRaw = sessionStorage.getItem(TENANTS)
    const tenants = tenantsRaw ? (JSON.parse(tenantsRaw) as TenantSummary[]) : []
    const activeTenantId = sessionStorage.getItem(ACTIVE_TENANT)
    const platformRoleRaw = sessionStorage.getItem(PLATFORM_ROLE)
    const platformRole = platformRoleRaw
      ? (platformRoleRaw as PlatformRole)
      : null

    return {
      accessToken,
      refreshToken,
      user: { ...parsed, user_level: Number(parsed.user_level) },
      platformRole,
      tenants,
      activeTenantId,
      isImpersonating: sessionStorage.getItem(IS_IMPERSONATING) === 'true',
      impersonatedTenantName: sessionStorage.getItem(IMPERSONATED_TENANT),
    }
  } catch {
    return {
      accessToken: null,
      refreshToken: null,
      user: null,
      platformRole: null,
      tenants: [],
      activeTenantId: null,
      isImpersonating: false,
      impersonatedTenantName: null,
    }
  }
}

export function persistSession(
  accessToken: string,
  refreshToken: string,
  user: AdminUser,
  tenants: TenantSummary[] = [],
  activeTenantId?: string | null,
  platformRole?: PlatformRole | null
): void {
  sessionStorage.setItem(ACCESS, accessToken)
  sessionStorage.setItem(REFRESH, refreshToken)
  sessionStorage.setItem(USER, JSON.stringify(user))
  sessionStorage.setItem(TENANTS, JSON.stringify(tenants))
  if (platformRole) {
    sessionStorage.setItem(PLATFORM_ROLE, platformRole)
  } else {
    sessionStorage.removeItem(PLATFORM_ROLE)
  }
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

export function persistImpersonationSession(
  accessToken: string,
  refreshToken: string,
  tenant: TenantSummary
): void {
  sessionStorage.setItem(ACCESS, accessToken)
  sessionStorage.setItem(REFRESH, refreshToken)
  sessionStorage.setItem(IS_IMPERSONATING, 'true')
  sessionStorage.setItem(IMPERSONATED_TENANT, tenant.displayName)
  const stored = loadStoredSession()
  const tenants = [...stored.tenants]
  if (!tenants.some((t) => t.id === tenant.id)) {
    tenants.push(tenant)
  }
  persistTenantSession(tenants, tenant.id)
}

export function clearImpersonationSession(
  accessToken: string,
  refreshToken: string
): void {
  sessionStorage.setItem(ACCESS, accessToken)
  sessionStorage.setItem(REFRESH, refreshToken)
  sessionStorage.removeItem(IS_IMPERSONATING)
  sessionStorage.removeItem(IMPERSONATED_TENANT)
  sessionStorage.removeItem(ACTIVE_TENANT)
}

export function clearSession(): void {
  sessionStorage.removeItem(ACCESS)
  sessionStorage.removeItem(REFRESH)
  sessionStorage.removeItem(USER)
  sessionStorage.removeItem(TENANTS)
  sessionStorage.removeItem(ACTIVE_TENANT)
  sessionStorage.removeItem(PLATFORM_ROLE)
  sessionStorage.removeItem(IS_IMPERSONATING)
  sessionStorage.removeItem(IMPERSONATED_TENANT)
}
