import { useCallback, useEffect, useState } from 'react'
import { fetchAuditLog } from '../../api/platform/audit'
import type { AuditLogItem } from '../../api/platform/audit'
import { auditActionLabel, formatDateTime } from '../../utils/format'
import styles from './platformPage.module.css'

export function AuditLogPage() {
  const [items, setItems] = useState<AuditLogItem[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAuditLog({
        page,
        pageSize: 50,
        action: actionFilter.trim() || undefined,
      })
      setItems(data.items)
      setTotalPages(data.pagination.totalPages)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar audit log.')
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Registo de auditoria</h1>
          <p className={styles.subtitle}>Ações da equipa LifeCity na plataforma</p>
        </div>
      </header>

      <div className={styles.filters}>
        <input
          className={styles.input}
          placeholder="Filtrar por ação (ex.: tenant.create)"
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value)
            setPage(1)
          }}
        />
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.card}>
        {loading ? (
          <p className={styles.muted}>A carregar…</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Ator</th>
                <th>Ação</th>
                <th>Alvo</th>
                <th>Cliente</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>{item.actorName}</td>
                  <td>{auditActionLabel(item.action)}</td>
                  <td>
                    {item.targetType}/{item.targetId.slice(0, 8)}…
                  </td>
                  <td>{item.tenantName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 ? (
          <div className={styles.pagination}>
            <button
              type="button"
              className={styles.btn}
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              className={styles.btn}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Seguinte
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
