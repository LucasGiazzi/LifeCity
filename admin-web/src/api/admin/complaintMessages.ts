import { adminFetch } from './client'

export type ComplaintChatMessage = {
  id: string
  sender_type: 'citizen' | 'municipality'
  body: string
  created_at: string
  read_by_citizen_at: string | null
  read_by_municipality_at: string | null
  display_name: string
}

export async function fetchComplaintMessages(
  complaintId: number,
  before?: string
): Promise<ComplaintChatMessage[]> {
  const qs = before ? `?before=${encodeURIComponent(before)}` : ''
  const data = await adminFetch<{ messages: ComplaintChatMessage[] }>(
    `/complaints/${complaintId}/messages${qs}`
  )
  return data.messages
}

export async function postComplaintMessage(
  complaintId: number,
  body: string
): Promise<ComplaintChatMessage> {
  const data = await adminFetch<{ message: ComplaintChatMessage }>(
    `/complaints/${complaintId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ body }),
    }
  )
  return data.message
}

export async function markComplaintMessagesRead(
  complaintId: number
): Promise<void> {
  await adminFetch(`/complaints/${complaintId}/messages/read`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  })
}

export function countUnreadCitizenMessages(
  messages: ComplaintChatMessage[]
): number {
  return messages.filter(
    (m) => m.sender_type === 'citizen' && m.read_by_municipality_at == null
  ).length
}
