import type { ComplaintCategory } from '../api/categories'

export type CategoryDisplay = {
  name: string
  iconKey: string
  color: string
}

type CategorySource = {
  category?: string | null
  category_name?: string | null
  category_color?: string | null
  category_icon?: string | null
}

export function resolveCategoryDisplay(
  source: CategorySource,
  catalog: ComplaintCategory | null
): CategoryDisplay {
  return {
    name:
      source.category_name?.trim() ||
      catalog?.name ||
      source.category?.trim() ||
      'Sem categoria',
    iconKey: source.category_icon || catalog?.iconKey || 'category',
    color: complaintMarkerColor(source.category_color, catalog?.colorHex),
  }
}

export function complaintMarkerColor(
  apiColor: string | null | undefined,
  catalogColor: string | null | undefined,
  fallback = '#00c896'
): string {
  return apiColor ?? catalogColor ?? fallback
}

export function normalizeCategorySlug(
  slug: string | null | undefined
): string | null {
  if (!slug) return null
  const trimmed = slug.trim()
  return trimmed.length > 0 ? trimmed.toLowerCase() : null
}
