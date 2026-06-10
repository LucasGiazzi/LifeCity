import { apiFetch } from '../httpClient'

export async function adminFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  let body: unknown
  if (init?.body != null && typeof init.body === 'string') {
    try {
      body = JSON.parse(init.body) as unknown
    } catch {
      body = init.body
    }
  }

  return apiFetch<T>(path, {
    admin: true,
    method: init?.method ?? 'GET',
    body,
    headers: init?.headers as Record<string, string> | undefined,
  })
}
