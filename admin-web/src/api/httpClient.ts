import { getApiBase } from './config'
import { loadStoredSession, persistAccessToken } from '../auth/storage'

export type HttpClientConfig = {
  onAccessTokenRefreshed: (accessToken: string) => void
  onSessionExpired: () => void
}

let clientConfig: HttpClientConfig | null = null
let refreshInFlight: Promise<string | null> | null = null

export function configureHttpClient(config: HttpClientConfig): void {
  clientConfig = config
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    return {}
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const { refreshToken } = loadStoredSession()
    if (!refreshToken) return null

    try {
      const res = await fetch(`${getApiBase()}/api/auth/refreshToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      const data = (await parseJson(res)) as { accessToken?: string; message?: string }
      if (!res.ok || !data.accessToken) return null

      persistAccessToken(data.accessToken)
      clientConfig?.onAccessTokenRefreshed(data.accessToken)
      return data.accessToken
    } catch {
      return null
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

export type ApiFetchOptions = {
  method?: string
  body?: unknown
  /** Prefixo /api/admin */
  admin?: boolean
  /** Prefixo /api/platform */
  platform?: boolean
  /** Envia Authorization (default: true) */
  auth?: boolean
  headers?: Record<string, string>
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    admin = false,
    platform = false,
    auth = true,
    headers: extraHeaders = {},
  } = options

  const base = admin
    ? `${getApiBase()}/api/admin`
    : platform
      ? `${getApiBase()}/api/platform`
      : `${getApiBase()}/api`

  const run = async (accessToken: string | null) => {
    const headers: Record<string, string> = {
      ...extraHeaders,
    }
    if (body !== undefined && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }
    if (auth && accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    return fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let accessToken = auth ? loadStoredSession().accessToken : null
  let res = await run(accessToken)

  if (auth && (res.status === 401 || res.status === 403)) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      accessToken = newToken
      res = await run(newToken)
    } else {
      clientConfig?.onSessionExpired()
      throw new Error('Sessão expirada. Inicie sessão novamente.')
    }
  }

  const data = (await parseJson(res)) as T & { message?: string }
  if (!res.ok) {
    throw new Error(data.message ?? 'Erro na requisição.')
  }
  return data
}

export async function apiFetchBlob(
  path: string,
  options: ApiFetchOptions = {}
): Promise<Blob> {
  const {
    method = 'GET',
    body,
    admin = false,
    platform = false,
    auth = true,
    headers: extraHeaders = {},
  } = options

  const base = admin
    ? `${getApiBase()}/api/admin`
    : platform
      ? `${getApiBase()}/api/platform`
      : `${getApiBase()}/api`

  const run = async (accessToken: string | null) => {
    const headers: Record<string, string> = { ...extraHeaders }
    if (body !== undefined && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }
    if (auth && accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }

    return fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let accessToken = auth ? loadStoredSession().accessToken : null
  let res = await run(accessToken)

  if (auth && (res.status === 401 || res.status === 403)) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      accessToken = newToken
      res = await run(newToken)
    } else {
      clientConfig?.onSessionExpired()
      throw new Error('Sessão expirada. Inicie sessão novamente.')
    }
  }

  if (!res.ok) {
    const data = (await parseJson(res)) as { message?: string }
    throw new Error(data.message ?? 'Erro na requisição.')
  }

  return res.blob()
}
