import type { InvitationResult } from './tenants'
import { platformFetch } from './client'

export type TenantMember = {
  userId: string
  name: string
  email: string
  role: string
  isActive: boolean
  joinedAt: string
}

export type PendingInvitation = {
  id: string
  email: string
  role: string
  expiresAt: string
  invitedByName: string
  passwordPending: boolean
  setupLink: string | null
}

export async function fetchTenantMembers(tenantId: string) {
  return platformFetch<{
    members: TenantMember[]
    pendingInvitations: PendingInvitation[]
  }>(`/tenants/${tenantId}/members`)
}

export async function inviteTenantMember(
  tenantId: string,
  payload: { email: string; role: string; name?: string }
) {
  return platformFetch<
    | { invitation: InvitationResult }
    | {
        memberAdded: true
        userId: string
        email: string
        role: string
        setupLink: null
        message: string
      }
  >(`/tenants/${tenantId}/members/invite`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function patchTenantMember(
  tenantId: string,
  userId: string,
  payload: { role?: string; isActive?: boolean }
) {
  return platformFetch<{ member: TenantMember }>(
    `/tenants/${tenantId}/members/${userId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  )
}
