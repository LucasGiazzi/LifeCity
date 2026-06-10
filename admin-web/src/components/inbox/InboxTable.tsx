import { useNavigate } from 'react-router-dom'
import type { InboxItem } from '../../api/admin/inbox'
import { useCategories } from '../../catalog/CategoriesContext'
import { formatDate, statusLabel } from '../../utils/format'
import { SlaBadge } from './SlaBadge'
import styles from './InboxTable.module.css'

type InboxTableProps = {
  items: InboxItem[]
  loading: boolean
}

export function InboxTable({ items, loading }: InboxTableProps) {
  const navigate = useNavigate()
  const { resolve } = useCategories()

  const openComplaint = (id: number) => {
    void navigate(`/admin/complaints/${id}`)
  }

  if (loading) {
    return <p className={styles.muted}>A carregar fila…</p>
  }

  if (items.length === 0) {
    return <p className={styles.muted}>Nenhuma ocorrência encontrada.</p>
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Categoria</th>
            <th>Status</th>
            <th>SLA</th>
            <th>Bairro</th>
            <th>Criada</th>
            <th>Equipe</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const catalog = resolve(item.category)
            const color = item.categoryColor ?? catalog?.colorHex ?? '#78909C'
            return (
              <tr
                key={item.id}
                className={styles.row}
                onClick={() => openComplaint(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openComplaint(item.id)
                  }
                }}
                tabIndex={0}
                role="link"
                aria-label={`Ver ocorrência #${item.id}`}
              >
                <td>
                  <span className={styles.idText}>#{item.id}</span>
                </td>
                <td>
                  <span className={styles.categoryCell}>
                    <span
                      className={styles.dot}
                      style={{ background: color }}
                      aria-hidden
                    />
                    {item.categoryName ?? item.category ?? '—'}
                  </span>
                </td>
                <td>{statusLabel(item.status)}</td>
                <td>
                  <SlaBadge state={item.slaState} dueAt={item.sla_due_at} />
                </td>
                <td>{item.bairroName ?? item.cd_bairro ?? '—'}</td>
                <td>{formatDate(item.created_at)}</td>
                <td>{item.assignedOpsTeamName ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
