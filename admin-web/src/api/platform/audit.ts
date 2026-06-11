import { platformFetch } from './client'

export type AuditLogItem = {
  id: string
  actorId: string
  actorName: string
  action: string
  targetType: string
  targetId: string
  tenantId: string | null
  tenantName: string | null
  payload: Record<string, unknown>
  createdAt: string
}

export async function fetchAuditLog(params?: {
  tenantId?: string
  action?: string
  actorId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}) {
  const qs = new URLSearchParams()
  if (params?.tenantId) qs.set('tenantId', params.tenantId)
  if (params?.action) qs.set('action', params.action)
  if (params?.actorId) qs.set('actorId', params.actorId)
  if (params?.from) qs.set('from', params.from)
  if (params?.to) qs.set('to', params.to)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize))
  const query = qs.toString()
  return platformFetch<{
    items: AuditLogItem[]
    pagination: { page: number; pageSize: number; total: number; totalPages: number }
  }>(`/audit-log${query ? `?${query}` : ''}`)
}
