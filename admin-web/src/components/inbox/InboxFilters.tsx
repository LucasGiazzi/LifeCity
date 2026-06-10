import type { InboxFilters } from '../../api/admin/inbox'
import { useCategories } from '../../catalog/CategoriesContext'
import styles from './InboxFilters.module.css'

type InboxFiltersBarProps = {
  filters: InboxFilters
  onChange: (next: InboxFilters) => void
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'pending', label: 'Pendente' },
  { value: 'triaged', label: 'Em análise' },
  { value: 'assigned', label: 'Atribuída' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'resolved', label: 'Resolvida' },
  { value: 'closed', label: 'Encerrada' },
]

const SLA_OPTIONS = [
  { value: '', label: 'Todos SLA' },
  { value: 'at_risk', label: 'Em risco' },
  { value: 'breached', label: 'Estourado' },
  { value: 'ok', label: 'OK' },
]

export function InboxFiltersBar({ filters, onChange }: InboxFiltersBarProps) {
  const { categories } = useCategories()

  return (
    <div className={styles.bar}>
      <label className={styles.field}>
        <span className={styles.label}>Status</span>
        <select
          className={styles.select}
          value={filters.status ?? ''}
          onChange={(e) =>
            onChange({ ...filters, status: e.target.value || undefined, page: 1 })
          }
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Categoria</span>
        <select
          className={styles.select}
          value={filters.category ?? ''}
          onChange={(e) =>
            onChange({ ...filters, category: e.target.value || undefined, page: 1 })
          }
        >
          <option value="">Todas</option>
          {categories.map((cat) => (
            <option key={cat.slug} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>SLA</span>
        <select
          className={styles.select}
          value={filters.sla ?? ''}
          onChange={(e) =>
            onChange({
              ...filters,
              sla: (e.target.value || undefined) as InboxFilters['sla'],
              page: 1,
            })
          }
        >
          {SLA_OPTIONS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className={`${styles.field} ${styles.searchField}`}>
        <span className={styles.label}>Busca</span>
        <input
          type="search"
          className={styles.input}
          placeholder="ID, endereço, descrição…"
          value={filters.q ?? ''}
          onChange={(e) =>
            onChange({ ...filters, q: e.target.value || undefined, page: 1 })
          }
        />
      </label>
    </div>
  )
}
