import { adminFetch } from './client'

export type ModerationReport = {
  id: string
  targetType: string
  targetId: string
  complaintId: number
  categoryName: string | null
  reason: string
  details: string | null
  status: string
  isHidden: boolean
  reporterName: string | null
  createdAt: string
}

export type ModerationListResponse = {
  items: ModerationReport[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export async function fetchModerationReports(
  page = 1,
  pageSize = 25
): Promise<ModerationListResponse> {
  const params = new URLSearchParams({
    status: 'pending',
    page: String(page),
    pageSize: String(pageSize),
  })
  return adminFetch<ModerationListResponse>(`/moderation/reports?${params}`)
}

export async function fetchModerationPendingCount(): Promise<number> {
  const data = await adminFetch<{ count: number }>('/moderation/pending-count')
  return data.count
}

export async function resolveModerationReport(
  id: string,
  body: { action: 'hide_complaint' | 'dismiss'; note?: string }
): Promise<void> {
  await adminFetch(`/moderation/reports/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
