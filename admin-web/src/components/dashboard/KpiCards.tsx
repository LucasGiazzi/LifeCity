import styles from './KpiCards.module.css'
import type { AnalyticsSummary } from '../../api/admin/analytics'

type KpiCardsProps = {
  summary: AnalyticsSummary | null
  loading: boolean
  filterLabel?: string | null
}

const cards: Array<{
  key: keyof Pick<
    AnalyticsSummary,
    'total' | 'pending' | 'last7Days' | 'distinctCategories'
  >
  label: string
}> = [
  { key: 'total', label: 'Total' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'last7Days', label: 'Últimos 7 dias' },
  { key: 'distinctCategories', label: 'Categorias' },
]

export function KpiCards({ summary, loading, filterLabel }: KpiCardsProps) {
  return (
    <div className={styles.wrap}>
      {filterLabel ? (
        <p className={styles.filterHint}>
          Filtrado: <strong>{filterLabel}</strong>
        </p>
      ) : null}
      <div className={styles.grid}>
      {cards.map(({ key, label }) => (
        <div key={key} className={styles.card}>
          <span className={styles.label}>{label}</span>
          <strong className={styles.value}>
            {loading || !summary ? '—' : summary[key]}
          </strong>
        </div>
      ))}
      </div>
    </div>
  )
}
