import { adminFetch } from './client'

export type ComplaintPoint = {
  id: number
  category: string | null
  category_name: string | null
  category_color: string | null
  category_icon: string | null
  status: string
  latitude: number | null
  longitude: number | null
  cd_setor: string | null
  cd_bairro: string | null
  created_at: string
  address: string | null
}

export type ComplaintPhoto = {
  name: string
  path: string
  url: string
}

export type ComplaintDetail = {
  id: number
  description: string | null
  occurrence_date: string | null
  category: string | null
  category_name: string | null
  category_color: string | null
  category_icon: string | null
  status: string
  address: string | null
  latitude: number | null
  longitude: number | null
  cd_mun: string | null
  cd_setor: string | null
  cd_bairro: string | null
  bairro_name: string | null
  is_within_city: boolean | null
  created_at: string
  created_by: string | null
  reporter_name: string | null
  reporter_email: string | null
  reporter_phone: string | null
}

export async function fetchAdminComplaints(params?: {
  category?: string
  from?: string
  to?: string
}): Promise<ComplaintPoint[]> {
  const search = new URLSearchParams()
  if (params?.category) search.set('category', params.category)
  if (params?.from) search.set('from', params.from)
  if (params?.to) search.set('to', params.to)
  const qs = search.toString()
  const data = await adminFetch<{ complaints: ComplaintPoint[] }>(
    `/complaints${qs ? `?${qs}` : ''}`
  )
  return data.complaints
}

export async function fetchAdminComplaintDetail(id: number): Promise<{
  complaint: ComplaintDetail
  photos: ComplaintPhoto[]
}> {
  return adminFetch(`/complaints/${id}`)
}
