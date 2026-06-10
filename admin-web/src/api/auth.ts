import { apiFetch } from './httpClient'
import { getApiBase } from './config'

export type AdminUser = {
  id: string
  email: string
  name: string
  phone?: string | null
  photo_url?: string | null
  birth_date?: string | null
  user_level: number
}

export type TenantSummary = {
  id: string
  slug: string
  displayName: string
  cd_mun: string
  role: string
}

export type LoginResponse = {
  message: string
  user: AdminUser & { cpf?: string | null }
  accessToken: string
  refreshToken: string
  tenants?: TenantSummary[]
  activeTenantId?: string
}

export type MeResponse = {
  user: AdminUser & { cpf?: string | null }
}

export { getApiBase }

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    return {}
  }
}

export async function loginRequest(
  email: string,
  password: string
): Promise<LoginResponse> {
  const res = await fetch(`${getApiBase()}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = (await parseJson(res)) as Partial<LoginResponse> & {
    message?: string
  }
  if (!res.ok) {
    throw new Error(data.message ?? 'Não foi possível iniciar sessão.')
  }
  if (!data.accessToken || !data.refreshToken || !data.user) {
    throw new Error('Resposta inválida do servidor.')
  }
  const level = Number(data.user.user_level ?? 1)
  if (!Number.isFinite(level)) {
    throw new Error('Resposta inválida do servidor.')
  }
  return {
    ...data,
    user: { ...data.user, user_level: level },
    tenants: data.tenants ?? [],
  } as LoginResponse
}

export async function getMeRequest(): Promise<AdminUser> {
  const data = await apiFetch<MeResponse>('/auth/me')
  if (!data.user) {
    throw new Error('Resposta inválida do servidor.')
  }
  const level = Number(data.user.user_level ?? 1)
  return { ...data.user, user_level: level }
}
