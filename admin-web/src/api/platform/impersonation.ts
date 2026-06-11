import type { TenantSummary } from '../auth'
import { platformFetch } from './client'

export async function enterTenantImpersonation(tenantId: string) {
  return platformFetch<{
    accessToken: string
    refreshToken: string
    tenant: TenantSummary
    impersonating: true
  }>(`/tenants/${tenantId}/enter`, { method: 'POST' })
}

export async function exitTenantImpersonation() {
  return platformFetch<{
    accessToken: string
    refreshToken: string
    impersonating: false
  }>('/exit-impersonation', { method: 'POST' })
}
