import { adminFetch } from './client'

export type OpsTeamDetail = {
  id: string
  name: string
  slug: string
  description: string | null
  defaultCategoryIds: string[]
  defaultCdBairros: string[]
  contactEmail: string | null
  isActive: boolean
  memberCount: number
}

export type OpsTeamMember = {
  userId: string
  name: string
  email: string
  role: 'lead' | 'member'
  joinedAt: string
}

export type TenantMember = {
  userId: string
  name: string
  email: string
  role: string
}

export async function fetchOpsTeamsDetailed(): Promise<OpsTeamDetail[]> {
  const data = await adminFetch<{ teams: OpsTeamDetail[] }>('/ops-teams')
  return data.teams
}

export async function createOpsTeam(body: {
  name: string
  description?: string
  defaultCategoryIds?: string[]
  defaultCdBairros?: string[]
  contactEmail?: string
}): Promise<OpsTeamDetail> {
  const data = await adminFetch<{ team: OpsTeamDetail }>('/ops-teams', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return data.team
}

export async function updateOpsTeam(
  id: string,
  body: Partial<{
    name: string
    description: string | null
    defaultCategoryIds: string[]
    defaultCdBairros: string[]
    contactEmail: string | null
    isActive: boolean
  }>
): Promise<OpsTeamDetail> {
  const data = await adminFetch<{ team: OpsTeamDetail }>(`/ops-teams/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return data.team
}

export async function fetchOpsTeamMembers(teamId: string): Promise<OpsTeamMember[]> {
  const data = await adminFetch<{ members: OpsTeamMember[] }>(
    `/ops-teams/${teamId}/members`
  )
  return data.members
}

export async function addOpsTeamMember(
  teamId: string,
  body: { userId: string; role?: 'lead' | 'member' }
): Promise<void> {
  await adminFetch(`/ops-teams/${teamId}/members`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function removeOpsTeamMember(
  teamId: string,
  userId: string
): Promise<void> {
  await adminFetch(`/ops-teams/${teamId}/members/${userId}`, {
    method: 'DELETE',
  })
}

export async function fetchTenantMembers(): Promise<TenantMember[]> {
  const data = await adminFetch<{ members: TenantMember[] }>('/tenant-members')
  return data.members
}
