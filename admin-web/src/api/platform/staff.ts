import type { PlatformRole } from '../auth'
import { platformFetch } from './client'

export type PlatformStaffMember = {
  userId: string
  name: string
  email: string
  role: PlatformRole
  isActive: boolean
  createdAt: string
}

export async function fetchPlatformStaff() {
  return platformFetch<{ staff: PlatformStaffMember[] }>('/staff')
}

export async function createPlatformStaff(payload: {
  email: string
  role: PlatformRole
}) {
  return platformFetch<{ staff: PlatformStaffMember }>('/staff', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function patchPlatformStaff(
  userId: string,
  payload: { role?: PlatformRole; isActive?: boolean }
) {
  return platformFetch<{ staff: PlatformStaffMember }>(`/staff/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
