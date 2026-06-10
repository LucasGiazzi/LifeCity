import { adminFetch } from './client'
import type { ComplaintDetail } from './complaints'

export type ComplaintEvent = {
  id: string
  event_type: string
  payload: Record<string, unknown>
  is_internal: boolean
  actor_name: string | null
  created_at: string
}

export type OpsTeam = {
  id: string
  name: string
  slug: string
  description: string | null
  isActive: boolean
  memberCount: number
}

export async function fetchOpsTeams(): Promise<OpsTeam[]> {
  const data = await adminFetch<{ teams: OpsTeam[] }>('/ops-teams')
  return data.teams
}

export async function patchComplaintStatus(
  id: number,
  body: { status: string; note?: string; isInternal?: boolean }
): Promise<{ complaint: ComplaintDetail; event: ComplaintEvent }> {
  return adminFetch(`/complaints/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function patchComplaintAssignment(
  id: number,
  body: {
    opsTeamId?: string | null
    userId?: string
    priority?: number
    note?: string
    isInternal?: boolean
  }
): Promise<{ complaint: ComplaintDetail; event: ComplaintEvent }> {
  return adminFetch(`/complaints/${id}/assignment`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function postComplaintNote(
  id: number,
  body: { text: string; isInternal?: boolean }
): Promise<{ event: ComplaintEvent }> {
  return adminFetch(`/complaints/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function fetchComplaintEvents(
  id: number,
  includeInternal = true
): Promise<ComplaintEvent[]> {
  const qs = includeInternal ? '' : '?includeInternal=false'
  const data = await adminFetch<{ events: ComplaintEvent[] }>(
    `/complaints/${id}/events${qs}`
  )
  return data.events
}
