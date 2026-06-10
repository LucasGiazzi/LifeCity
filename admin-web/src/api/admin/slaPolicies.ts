import { adminFetch } from './client'

export type SlaPolicy = {
  id: string
  categoryId: string
  categorySlug?: string
  categoryName: string
  responseHours: number
  resolutionHours: number
  businessHoursOnly?: boolean
  isActive: boolean
}

export async function fetchSlaPolicies(): Promise<SlaPolicy[]> {
  const data = await adminFetch<{ policies: SlaPolicy[] }>('/sla-policies')
  return data.policies
}

export async function saveSlaPolicies(
  policies: Array<{
    categoryId: string
    responseHours: number
    resolutionHours: number
    isActive?: boolean
  }>
): Promise<SlaPolicy[]> {
  const data = await adminFetch<{ policies: SlaPolicy[] }>('/sla-policies', {
    method: 'PUT',
    body: JSON.stringify({ policies }),
  })
  return data.policies
}
