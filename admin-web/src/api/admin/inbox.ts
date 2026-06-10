import { adminFetch, adminFetchBlob } from './client'

export type SlaState = 'ok' | 'at_risk' | 'breached'

export type InboxItem = {
  id: number
  category: string | null
  categoryName: string | null
  categoryColor: string | null
  status: string
  priority: number
  address: string | null
  created_at: string
  sla_due_at: string | null
  slaState: SlaState
  assignedOpsTeamId: string | null
  assignedOpsTeamName: string | null
  assignedUserName: string | null
  cd_bairro: string | null
  bairroName: string | null
}

export type InboxFilters = {
  status?: string
  category?: string
  sla?: SlaState
  priority?: number
  q?: string
  page?: number
  pageSize?: number
  sort?: 'created_at' | 'sla_due_at' | 'priority'
  order?: 'asc' | 'desc'
}

export type InboxResponse = {
  items: InboxItem[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export async function fetchInbox(filters: InboxFilters = {}): Promise<InboxResponse> {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.category) params.set('category', filters.category)
  if (filters.sla) params.set('sla', filters.sla)
  if (filters.priority != null) params.set('priority', String(filters.priority))
  if (filters.q) params.set('q', filters.q)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize))
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.order) params.set('order', filters.order)

  const qs = params.toString()
  return adminFetch<InboxResponse>(`/complaints/inbox${qs ? `?${qs}` : ''}`)
}

export async function exportInboxCsv(filters: InboxFilters = {}): Promise<Blob> {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.category) params.set('category', filters.category)
  if (filters.sla) params.set('sla', filters.sla)
  if (filters.priority != null) params.set('priority', String(filters.priority))
  if (filters.q) params.set('q', filters.q)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.order) params.set('order', filters.order)

  const qs = params.toString()
  return adminFetchBlob(`/complaints/export${qs ? `?${qs}` : ''}`)
}
