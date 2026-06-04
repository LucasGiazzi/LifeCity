import { apiFetch } from './httpClient'

export type ComplaintCategory = {
  id: string
  slug: string
  name: string
  shortName: string
  colorHex: string
  iconKey: string
  description: string | null
  sortOrder: number
}

export async function fetchComplaintCategories(
  admin = false
): Promise<ComplaintCategory[]> {
  const data = await apiFetch<{ categories: ComplaintCategory[] }>(
    '/categories',
    { admin, auth: admin }
  )
  return data.categories
}
