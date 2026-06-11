import { platformFetch } from './client'

export type TenantCitizen = {
  userId: string
  name: string
  email: string
  photoUrl: string | null
  homeCdMun: string | null
  addressConfirmedAt: string | null
  registeredAt: string
  complaintCount: number
  resolvedComplaintCount: number
  lastComplaintAt: string | null
  isResident: boolean
}

export async function fetchTenantCitizens(
  tenantId: string,
  params?: { q?: string; page?: number; pageSize?: number }
) {
  const qs = new URLSearchParams()
  if (params?.q) qs.set('q', params.q)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize))
  const query = qs.toString()
  return platformFetch<{
    items: TenantCitizen[]
    pagination: { page: number; pageSize: number; total: number; totalPages: number }
  }>(`/tenants/${tenantId}/citizens${query ? `?${query}` : ''}`)
}
