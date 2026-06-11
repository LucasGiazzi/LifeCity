import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchTenantCitizens } from '../../api/platform/citizens'
import type { TenantCitizen } from '../../api/platform/citizens'
import { fetchTenant } from '../../api/platform/tenants'
import { TenantTabs } from '../../components/platform/TenantTabs'
import { formatDateTime } from '../../utils/format'
import styles from './platformPage.module.css'

export function TenantCitizensPage() {
  const { id } = useParams<{ id: string }>()
  const [tenantName, setTenantName] = useState('')
  const [items, setItems] = useState<TenantCitizen[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [detail, citizens] = await Promise.all([
        fetchTenant(id),
        fetchTenantCitizens(id, {
          page,
          pageSize: 25,
          q: search.trim() || undefined,
        }),
      ])
      setTenantName(detail.tenant.displayName)
      setItems(citizens.items)
      setTotalPages(citizens.pagination.totalPages)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar cidadãos.')
    } finally {
      setLoading(false)
    }
  }, [id, page, search])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{tenantName || 'Cidadãos'}</h1>
          <p className={styles.subtitle}>
            Moradores e utilizadores com ocorrências neste município
          </p>
        </div>
        <Link to={`/platform/tenants/${id}`} className={styles.btn}>
          Voltar ao resumo
        </Link>
      </header>

      {id ? <TenantTabs tenantId={id} /> : null}

      <div className={styles.filters}>
        <input
          className={styles.input}
          placeholder="Buscar por nome ou e-mail…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
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
        ) : items.length === 0 ? (
          <p className={styles.muted}>Nenhum cidadão encontrado.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Morador</th>
                <th>Ocorrências</th>
                <th>Resolvidas</th>
                <th>Última ocorrência</th>
                <th>Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.userId}>
                  <td>{c.name}</td>
                  <td>{c.email}</td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        c.isResident ? styles.badgeOk : styles.badgeTrial
                      }`}
                    >
                      {c.isResident ? 'Sim' : 'Não'}
                    </span>
                  </td>
                  <td>{c.complaintCount}</td>
                  <td>{c.resolvedComplaintCount}</td>
                  <td>{formatDateTime(c.lastComplaintAt)}</td>
                  <td>{formatDateTime(c.registeredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 ? (
          <div className={styles.wizardNav} style={{ marginTop: 16 }}>
            <button
              type="button"
              className={styles.btn}
              disabled={page <= 1}
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
