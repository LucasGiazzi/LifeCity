import type {
  AnalyticsSummary,
  AreaRankItem,
  CategoryItem,
} from '../api/admin/analytics'
import type { ComplaintPoint } from '../api/admin/complaints'

export function filterComplaintsBySetor(
  complaints: ComplaintPoint[],
  cdSetor: string | null
): ComplaintPoint[] {
  if (!cdSetor) return complaints
  return complaints.filter((c) => c.cd_setor === cdSetor)
}

export function filterComplaintsByBairro(
  complaints: ComplaintPoint[],
  cdBairro: string | null
): ComplaintPoint[] {
  if (!cdBairro) return complaints
  return complaints.filter((c) => c.cd_bairro === cdBairro)
}

export function filterComplaintsByCategory(
  complaints: ComplaintPoint[],
  categorySlug: string | null
): ComplaintPoint[] {
  if (!categorySlug) return complaints
  return complaints.filter(
    (c) => (c.category?.trim() || 'outros') === categorySlug
  )
}

export function computeSummaryFromComplaints(
  complaints: ComplaintPoint[]
): Pick<
  AnalyticsSummary,
  'total' | 'pending' | 'last7Days' | 'distinctCategories'
> {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  const categories = new Set<string>()
  let pending = 0
  let last7Days = 0

  for (const complaint of complaints) {
    if ((complaint.status ?? 'pending') === 'pending') pending += 1
    if (new Date(complaint.created_at).getTime() >= sevenDaysAgo) last7Days += 1
    if (complaint.category) categories.add(complaint.category)
  }

  return {
    total: complaints.length,
    pending,
    last7Days,
    distinctCategories: categories.size,
  }
}

export function computeCategoryBreakdown(
  complaints: ComplaintPoint[]
): CategoryItem[] {
  const groups = new Map<
    string,
    {
      slug: string
      name: string
      colorHex: string
      iconKey: string
      count: number
    }
  >()

  for (const complaint of complaints) {
    const slug = complaint.category?.trim() || 'outros'
    const existing = groups.get(slug)
    if (existing) {
      existing.count += 1
      continue
    }
    groups.set(slug, {
      slug,
      name: complaint.category_name?.trim() || slug,
      colorHex: complaint.category_color ?? '#BDBDBD',
      iconKey: complaint.category_icon ?? 'help_outline',
      count: 1,
    })
  }

  const total = complaints.length

  return Array.from(groups.values())
    .map((item) => ({
      slug: item.slug,
      name: item.name,
      category: item.name,
      colorHex: item.colorHex,
      iconKey: item.iconKey,
      count: item.count,
      percent: total === 0 ? 0 : Math.round((item.count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count)
}

function computeAreaRanking(
  complaints: ComplaintPoint[],
  field: 'cd_setor' | 'cd_bairro',
  labelMap: Record<string, string> = {},
  limit = 10
): AreaRankItem[] {
  const counts = new Map<string, number>()

  for (const complaint of complaints) {
    const code = complaint[field]
    if (!code) continue
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([code, count]) => ({
      code,
      label: labelMap[code] ?? code,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function computeSetorRanking(
  complaints: ComplaintPoint[],
  labelMap: Record<string, string> = {},
  limit = 10
): AreaRankItem[] {
  return computeAreaRanking(complaints, 'cd_setor', labelMap, limit)
}

export function computeBairroRanking(
  complaints: ComplaintPoint[],
  labelMap: Record<string, string> = {},
  limit = 10
): AreaRankItem[] {
  return computeAreaRanking(complaints, 'cd_bairro', labelMap, limit)
}

export function buildAreaLabelMaps(
  ranking: { bySetor: AreaRankItem[]; byBairro: AreaRankItem[] }
): { setor: Record<string, string>; bairro: Record<string, string> } {
  return {
    setor: Object.fromEntries(
      ranking.bySetor.map((item) => [item.code, item.label])
    ),
    bairro: Object.fromEntries(
      ranking.byBairro.map((item) => [item.code, item.label])
    ),
  }
}
