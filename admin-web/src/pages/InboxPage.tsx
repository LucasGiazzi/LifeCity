import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  exportInboxCsv,
  fetchInbox,
  type InboxFilters,
  type InboxItem,
} from '../api/admin/inbox'
import { InboxFiltersBar } from '../components/inbox/InboxFilters'
import { InboxTable } from '../components/inbox/InboxTable'
import styles from './InboxPage.module.css'

export function InboxPage() {
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<InboxFilters>(() => ({
    page: 1,
    pageSize: 25,
    sort: 'created_at',
    order: 'desc',
    sla: (searchParams.get('sla') as InboxFilters['sla']) || undefined,
  }))
  const [items, setItems] = useState<InboxItem[]>([])
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchInbox(filters)
      setItems(data.items)
      setTotalPages(data.pagination.totalPages)
      setTotal(data.pagination.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar inbox.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    void load()
  }, [load])

  const handleExport = async () => {
    setExporting(true)
    setError(null)
    try {
      const { page: _page, pageSize: _pageSize, ...exportFilters } = filters
      const blob = await exportInboxCsv(exportFilters)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `ocorrencias-${new Date().toISOString().slice(0, 10)}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao exportar CSV.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Inbox de ocorrências</h1>
          <p className={styles.subtitle}>
            Fila operacional do município · {total} registo{total === 1 ? '' : 's'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={exporting || loading}
            onClick={() => void handleExport()}
          >
            {exporting ? 'A exportar…' : 'Export CSV'}
          </button>
          <Link to="/admin" className={styles.backLink}>
            ← Dashboard
          </Link>
        </div>
      </header>

      <InboxFiltersBar filters={filters} onChange={setFilters} />

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <InboxTable items={items} loading={loading} />

      {totalPages > 1 ? (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={loading || (filters.page ?? 1) <= 1}
            onClick={() =>
              setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }))
            }
          >
            Anterior
          </button>
          <span className={styles.pageInfo}>
            Página {filters.page ?? 1} de {totalPages}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={loading || (filters.page ?? 1) >= totalPages}
            onClick={() =>
              setFilters((f) => ({
                ...f,
                page: Math.min(totalPages, (f.page ?? 1) + 1),
              }))
            }
          >
            Seguinte
          </button>
        </div>
      ) : null}
    </div>
  )
}
