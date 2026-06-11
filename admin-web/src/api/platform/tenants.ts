import { platformFetch } from './client'

export type TenantStatus = 'trial' | 'active' | 'suspended'

export type TenantCoverage = {
  bairrosLoaded: boolean
  setoresLoaded: boolean
  bairroCount?: number
  setorCount?: number
}

export type TenantListItem = {
  id: string
  cd_mun: string
  slug: string
  displayName: string
  status: TenantStatus
  activatedAt: string | null
  createdAt: string
  memberCount: number
  complaintCount: number
  coverage: TenantCoverage
}

export type TenantBillingSettings = {
  population?: number
  population_source?: string
  base_monthly_brl?: number
  infra_monthly_brl?: number
  total_monthly_brl?: number
  contract_months?: number
  total_contract_brl?: number
  estimated_at?: string
}

export type TenantSettings = {
  geo?: {
    cep_prefixes?: string[]
    bounds?: {
      lat_min: number
      lat_max: number
      lng_min: number
      lng_max: number
    }
  }
  features?: {
    chat_enabled?: boolean
    missions_enabled?: boolean
  }
  billing?: TenantBillingSettings
}

export type TenantDetail = {
  id: string
  cd_mun: string
  slug: string
  displayName: string
  status: TenantStatus
  settings: TenantSettings
  activatedAt: string | null
  createdAt: string
}

export type TenantStats = {
  memberCount: number
  complaintCount: number
  complaintsLast7Days: number
  citizenCount: number
  opsTeamCount: number
  resolvedCount: number
  resolutionRatePct: number | null
  avgResolutionDays: number | null
}

export type HealthCheck = {
  key: string
  ok: boolean
  detail: string
}

export type TenantHealth = {
  status: 'healthy' | 'degraded' | 'critical'
  checks: HealthCheck[]
  computedAt: string
}

export type CreateTenantPayload = {
  cd_mun: string
  slug: string
  displayName: string
  status: TenantStatus
  settings?: TenantSettings
  seedDefaults?: boolean
  billing?: {
    contractMonths: 12 | 24 | 36
    populationOverride?: number | null
  }
  inviteOwner?: {
    email: string
    name?: string
  }
}

export type InvitationResult = {
  id: string
  email: string
  role?: string
  expiresAt: string
  setupLink: string
  emailSent: boolean
  accountCreated: boolean
}

export async function fetchTenants(params?: {
  status?: TenantStatus
  q?: string
  page?: number
  pageSize?: number
  sort?: string
  order?: 'asc' | 'desc'
}) {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.q) qs.set('q', params.q)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize))
  if (params?.sort) qs.set('sort', params.sort)
  if (params?.order) qs.set('order', params.order)
  const query = qs.toString()
  return platformFetch<{
    items: TenantListItem[]
    pagination: { page: number; pageSize: number; total: number; totalPages: number }
  }>(`/tenants${query ? `?${query}` : ''}`)
}

export async function fetchTenant(id: string) {
  return platformFetch<{
    tenant: TenantDetail
    stats: TenantStats
    coverage: TenantCoverage
  }>(`/tenants/${id}`)
}

export async function createTenant(payload: CreateTenantPayload) {
  return platformFetch<{
    tenant: TenantDetail
    seed: { opsTeamsCreated: number; slaPoliciesCreated: number }
    invitation?: InvitationResult
    coverage: TenantCoverage
  }>('/tenants', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type PatchTenantPayload = Partial<{
  displayName: string
  slug: string
  status: TenantStatus
  settings: TenantSettings
  billing: { contractMonths: 12 | 24 | 36; populationOverride?: number | null }
}>

export async function patchTenant(id: string, payload: PatchTenantPayload) {
  return platformFetch<{ tenant: TenantDetail }>(`/tenants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function fetchTenantHealth(id: string) {
  return platformFetch<TenantHealth>(`/tenants/${id}/health`)
}
