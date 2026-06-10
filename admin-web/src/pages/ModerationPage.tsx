import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fetchModerationReports,
  resolveModerationReport,
  type ModerationReport,
} from '../api/admin/moderation'
import { formatDateTime } from '../utils/format'
import styles from './AdminSettingsPage.module.css'

export function ModerationPage() {
  const [items, setItems] = useState<ModerationReport[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchModerationReports(page)
      setItems(data.items)
      setTotalPages(data.pagination.totalPages)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar denúncias.')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  const handleResolve = async (
    id: string,
    action: 'hide_complaint' | 'dismiss'
  ) => {
    setActingId(id)
    setError(null)
    try {
      await resolveModerationReport(id, { action })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao tratar denúncia.')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Moderação</h1>
          <p className={styles.subtitle}>Denúncias de ocorrências pendentes</p>
        </div>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.card}>
        {loading ? (
          <p className={styles.muted}>A carregar…</p>
        ) : items.length === 0 ? (
          <p className={styles.muted}>Nenhuma denúncia pendente.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Ocorrência</th>
                <th>Motivo</th>
                <th>Denunciante</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link to={`/admin/complaints/${item.complaintId}`}>
                      #{item.complaintId}
                    </Link>
                    {item.categoryName ? (
                      <div className={styles.muted}>{item.categoryName}</div>
                    ) : null}
                  </td>
                  <td>
                    {item.reason}
                    {item.details ? (
                      <div className={styles.muted}>{item.details}</div>
                    ) : null}
                  </td>
                  <td>{item.reporterName ?? '—'}</td>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.btnDanger}
                        disabled={actingId === item.id}
                        onClick={() => void handleResolve(item.id, 'hide_complaint')}
                      >
                        Ocultar
                      </button>
                      <button
                        type="button"
                        className={styles.btn}
                        disabled={actingId === item.id}
                        onClick={() => void handleResolve(item.id, 'dismiss')}
                      >
                        Dispensar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 ? (
        <div className={styles.actions} style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className={styles.btn}
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <span className={styles.muted}>
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            className={styles.btn}
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Seguinte
          </button>
        </div>
      ) : null}
    </div>
  )
}
