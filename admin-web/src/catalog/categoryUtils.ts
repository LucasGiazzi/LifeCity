const ICON_LABELS: Record<string, string> = {
  construction: 'Infra',
  security: 'Segurança',
  cleaning_services: 'Limpeza',
  traffic: 'Trânsito',
  report_problem: 'Outros',
  category: 'Categoria',
  help_outline: 'Outros',
}

export function categoryIconLabel(iconKey: string | null | undefined): string {
  if (!iconKey) return '•'
  return ICON_LABELS[iconKey] ?? '•'
}

export function normalizeCategorySlug(
  slug: string | null | undefined
): string | null {
  if (!slug) return null
  const trimmed = slug.trim()
  return trimmed.length > 0 ? trimmed.toLowerCase() : null
}

export function complaintMarkerColor(
  apiColor: string | null | undefined,
  catalogColor: string | null | undefined,
  fallback = '#00c896'
): string {
  return apiColor ?? catalogColor ?? fallback
}
