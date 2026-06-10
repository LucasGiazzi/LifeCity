import { adminFetch } from './client'

export type AnalyticsSummary = {
  total: number
  pending: number
  last7Days: number
  distinctCategories: number
  coverage: {
    bairrosLoaded: boolean
    setoresLoaded: boolean
  }
  operational?: {
    backlog: number
    slaAtRisk: number
    slaBreached: number
  }
}

export type CategoryItem = {
  slug: string
  name: string
  /** @deprecated use name */
  category: string
  colorHex: string
  iconKey: string
  count: number
  percent: number
}

export type AreaRankItem = {
  code: string
  label: string
  count: number
}

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  return adminFetch<AnalyticsSummary>('/analytics/summary')
}

export async function fetchAnalyticsByCategory(): Promise<CategoryItem[]> {
  const data = await adminFetch<{ items: CategoryItem[] }>(
    '/analytics/by-category'
  )
  return data.items
}

export async function fetchAnalyticsRanking(): Promise<{
  bySetor: AreaRankItem[]
  byBairro: AreaRankItem[]
}> {
  return adminFetch('/analytics/ranking-areas')
}
