import { Link } from 'react-router-dom'
import type { AnalyticsSummary } from '../../api/admin/analytics'
import styles from './OpsKpiCards.module.css'

type OpsKpiCardsProps = {
  summary: AnalyticsSummary | null
  loading: boolean
}

export function OpsKpiCards({ summary, loading }: OpsKpiCardsProps) {
  const ops = summary?.operational

  const cards: Array<{
    key: string
    label: string
    value: number | undefined
    link: string
    accent?: string
  }> = [
    { key: 'backlog', label: 'Backlog operacional', value: ops?.backlog, link: '/admin/inbox' },
    {
      key: 'at_risk',
      label: 'SLA em risco',
      value: ops?.slaAtRisk,
      link: '/admin/inbox?sla=at_risk',
      accent: '#D97706',
    },
    {
      key: 'breached',
      label: 'SLA estourado',
      value: ops?.slaBreached,
      link: '/admin/inbox?sla=breached',
      accent: '#DC2626',
    },
  ]

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h2 className={styles.title}>Operacional</h2>
        <Link to="/admin/inbox" className={styles.inboxLink}>
          Ver inbox →
        </Link>
      </div>
      <div className={styles.grid}>
        {cards.map((card) => (
          <Link
            key={card.key}
            to={card.link}
            className={styles.card}
            style={card.accent ? { borderColor: `${card.accent}30` } : undefined}
          >
            <span className={styles.label}>{card.label}</span>
            <strong
              className={styles.value}
              style={card.accent ? { color: card.accent } : undefined}
            >
              {loading || ops == null ? '—' : card.value}
            </strong>
          </Link>
        ))}
      </div>
    </div>
  )
}
