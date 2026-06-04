import type { TenantSummary } from '../auth'
import { adminFetch } from './client'

export async function fetchMyTenants(): Promise<TenantSummary[]> {
  const data = await adminFetch<{ tenants: TenantSummary[] }>('/tenants/mine')
  return data.tenants
}

export async function switchTenantRequest(
  tenantId: string
): Promise<{ accessToken: string; activeTenantId: string }> {
  return adminFetch('/tenants/switch', {
    method: 'POST',
    body: JSON.stringify({ tenantId }),
  })
}
