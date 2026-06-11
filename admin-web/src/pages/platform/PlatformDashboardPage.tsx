import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlatform } from '../../auth/usePlatform'
import { fetchAuditLog } from '../../api/platform/audit'
import type { AuditLogItem } from '../../api/platform/audit'
import { fetchTenants, fetchTenantHealth } from '../../api/platform/tenants'
import { auditActionLabel, formatDateTime } from '../../utils/format'
import styles from './platformPage.module.css'

export function PlatformDashboardPage() {
  const { canOperate } = usePlatform()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tenantCounts, setTenantCounts] = useState({ total: 0, trial: 0, active: 0, suspended: 0 })
  const [complaintsTotal, setComplaintsTotal] = useState(0)
  const [degradedCount, setDegradedCount] = useState(0)
  const [recentAudit, setRecentAudit] = useState<AuditLogItem[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [tenantsRes, auditRes] = await Promise.all([
          fetchTenants({ pageSize: 100 }),
          fetchAuditLog({ pageSize: 8 }),
        ])
        if (cancelled) return

        const items = tenantsRes.items
        setTenantCounts({
          total: tenantsRes.pagination.total,
          trial: items.filter((t) => t.status === 'trial').length,
          active: items.filter((t) => t.status === 'active').length,
          suspended: items.filter((t) => t.status === 'suspended').length,
        })
        setComplaintsTotal(items.reduce((sum, t) => sum + t.complaintCount, 0))
        setRecentAudit(auditRes.items)

        const healthResults = await Promise.all(
          items.slice(0, 15).map((t) =>
            fetchTenantHealth(t.id).catch(() => ({ status: 'healthy' as const }))
          )
        )
        if (!cancelled) {
          setDegradedCount(
            healthResults.filter((h) => h.status !== 'healthy').length
          )
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao carregar dashboard.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Painel da plataforma</h1>
          <p className={styles.subtitle}>Visão global dos clientes LifeCity</p>
        </div>
        {canOperate ? (
          <Link to="/platform/tenants/new" className={styles.btnPrimary}>
            Novo cliente
          </Link>
        ) : null}
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total clientes</span>
          <strong className={styles.kpiValue}>
            {loading ? '—' : tenantCounts.total}
          </strong>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Trial / Ativo / Suspenso</span>
          <strong className={styles.kpiValue}>
            {loading
              ? '—'
              : `${tenantCounts.trial} / ${tenantCounts.active} / ${tenantCounts.suspended}`}
          </strong>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Ocorrências (total)</span>
          <strong className={styles.kpiValue}>
            {loading ? '—' : complaintsTotal}
          </strong>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Clientes com pendências</span>
          <strong className={styles.kpiValue}>
            {loading ? '—' : degradedCount}
          </strong>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Últimas ações</h2>
        {loading ? (
          <p className={styles.muted}>A carregar…</p>
        ) : recentAudit.length === 0 ? (
          <p className={styles.muted}>Nenhuma ação registada.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Data</th>
                <th>Ator</th>
                <th>Ação</th>
                <th>Cliente</th>
              </tr>
            </thead>
            <tbody>
              {recentAudit.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>{item.actorName}</td>
                  <td>{auditActionLabel(item.action)}</td>
                  <td>{item.tenantName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ marginTop: 12 }}>
          <Link to="/platform/audit" className={styles.btn}>
            Ver audit log completo
          </Link>
        </p>
      </div>
    </div>
  )
}
