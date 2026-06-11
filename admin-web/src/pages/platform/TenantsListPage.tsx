import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlatform } from '../../auth/usePlatform'
import {
  fetchTenants,
  patchTenant,
  type TenantListItem,
  type TenantStatus,
} from '../../api/platform/tenants'
import { tenantStatusLabel } from '../../utils/format'
import styles from './platformPage.module.css'

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'active'
      ? styles.badgeActive
      : status === 'suspended'
        ? styles.badgeSuspended
        : styles.badgeTrial
  return (
    <span className={`${styles.badge} ${cls}`}>
      {tenantStatusLabel(status)}
    </span>
  )
}

export function TenantsListPage() {
  const { canOperate, canAdmin, enterTenant, isEntering } = usePlatform()
  const [items, setItems] = useState<TenantListItem[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<TenantStatus | ''>('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTenants({
        page,
        pageSize: 25,
        status: statusFilter || undefined,
        q: search.trim() || undefined,
      })
      setItems(data.items)
      setTotalPages(data.pagination.totalPages)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar clientes.')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, search])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSuspend(id: string) {
    if (!window.confirm('Suspender este cliente?')) return
    try {
      await patchTenant(id, { status: 'suspended' })
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao suspender.')
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Clientes</h1>
          <p className={styles.subtitle}>Prefeituras cadastradas na plataforma</p>
        </div>
        {canOperate ? (
          <Link to="/platform/tenants/new" className={styles.btnPrimary}>
            Novo cliente
          </Link>
        ) : null}
      </header>

      <div className={styles.filters}>
        <input
          className={styles.input}
          placeholder="Buscar nome, slug ou código IBGE…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <select
          className={styles.select}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as TenantStatus | '')
            setPage(1)
          }}
        >
          <option value="">Todos os status</option>
          <option value="trial">Trial</option>
          <option value="active">Ativo</option>
          <option value="suspended">Suspenso</option>
        </select>
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
                <th>Nome</th>
                <th>Código IBGE</th>
                <th>Status</th>
                <th>Membros</th>
                <th>Ocorrências</th>
                <th>Malhas</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.displayName}</strong>
                    <br />
                    <span className={styles.muted}>{t.slug}</span>
                  </td>
                  <td>{t.cd_mun}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td>{t.memberCount}</td>
                  <td>{t.complaintCount}</td>
                  <td>
                    {t.coverage.bairrosLoaded && t.coverage.setoresLoaded ? (
                      <span className={`${styles.badge} ${styles.badgeOk}`}>
                        OK
                      </span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeWarn}`}>
                        Parcial
                      </span>
                    )}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <Link
                        to={`/platform/tenants/${t.id}`}
                        className={`${styles.btn} ${styles.btnSm}`}
                      >
                        Ver
                      </Link>
                      {canOperate ? (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSm}`}
                          disabled={isEntering}
                          onClick={() => void enterTenant(t.id)}
                        >
                          Entrar
                        </button>
                      ) : null}
                      {canAdmin && t.status !== 'suspended' ? (
                        <button
                          type="button"
                          className={`${styles.btnDanger} ${styles.btnSm}`}
                          onClick={() => void handleSuspend(t.id)}
                        >
                          Suspender
                        </button>
                      ) : null}
                    </div>
                  </td>
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
