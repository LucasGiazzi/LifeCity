import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePlatform } from '../../auth/usePlatform'
import {
  fetchTenant,
  fetchTenantHealth,
  patchTenant,
  type TenantDetail,
  type TenantHealth,
  type TenantStats,
  type TenantCoverage,
} from '../../api/platform/tenants'
import { TenantTabs } from '../../components/platform/TenantTabs'
import {
  formatBrl,
  formatDateTime,
  formatDurationDays,
  formatPercent,
  formatPopulation,
  healthCheckDetail,
  healthCheckLabel,
  healthStatusLabel,
  populationSourceLabel,
  tenantStatusLabel,
} from '../../utils/format'
import styles from './platformPage.module.css'

type LocalTab = 'resumo' | 'config'

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { canOperate, canAdmin, enterTenant, isEntering } = usePlatform()
  const [localTab, setLocalTab] = useState<LocalTab>('resumo')
  const [tenant, setTenant] = useState<TenantDetail | null>(null)
  const [stats, setStats] = useState<TenantStats | null>(null)
  const [coverage, setCoverage] = useState<TenantCoverage | null>(null)
  const [health, setHealth] = useState<TenantHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [slug, setSlug] = useState('')
  const [status, setStatus] = useState<string>('trial')
  const [chatEnabled, setChatEnabled] = useState(true)
  const [missionsEnabled, setMissionsEnabled] = useState(false)
  const [contractMonths, setContractMonths] = useState<12 | 24 | 36>(24)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [detail, healthData] = await Promise.all([
        fetchTenant(id),
        fetchTenantHealth(id),
      ])
      setTenant(detail.tenant)
      setStats(detail.stats)
      setCoverage(detail.coverage)
      setHealth(healthData)
      setDisplayName(detail.tenant.displayName)
      setSlug(detail.tenant.slug)
      setStatus(detail.tenant.status)
      setChatEnabled(detail.tenant.settings?.features?.chat_enabled ?? true)
      setMissionsEnabled(
        detail.tenant.settings?.features?.missions_enabled ?? false
      )
      setContractMonths(
        (detail.tenant.settings?.billing?.contract_months as 12 | 24 | 36) ??
          24
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar cliente.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSaveConfig() {
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      await patchTenant(id, {
        displayName: displayName.trim(),
        slug: slug.trim(),
        status: status as 'trial' | 'active' | 'suspended',
        settings: {
          features: {
            chat_enabled: chatEnabled,
            missions_enabled: missionsEnabled,
          },
        },
        billing: canOperate
          ? {
              contractMonths,
              populationOverride:
                tenant?.settings?.billing?.population ?? null,
            }
          : undefined,
      })
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.muted}>A carregar…</p>
      </div>
    )
  }

  if (!tenant || !id) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>Cliente não encontrado.</p>
        <Link to="/platform/tenants" className={styles.btn}>
          Voltar
        </Link>
      </div>
    )
  }

  const billing = tenant.settings?.billing

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{tenant.displayName}</h1>
          <p className={styles.subtitle}>
            {tenant.slug} · Código IBGE {tenant.cd_mun} ·{' '}
            {tenantStatusLabel(tenant.status)}
          </p>
        </div>
        <div className={styles.actions}>
          {canOperate ? (
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={isEntering}
              onClick={() => void enterTenant(tenant.id)}
            >
              Entrar no município
            </button>
          ) : null}
          <Link to="/platform/tenants" className={styles.btn}>
            Voltar
          </Link>
        </div>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <TenantTabs tenantId={id} />

      {canOperate ? (
        <div className={styles.tabs} style={{ marginTop: 0 }}>
          <button
            type="button"
            className={localTab === 'resumo' ? styles.tabActive : styles.tab}
            onClick={() => setLocalTab('resumo')}
          >
            Visão geral
          </button>
          <button
            type="button"
            className={localTab === 'config' ? styles.tabActive : styles.tab}
            onClick={() => setLocalTab('config')}
          >
            Configurações
          </button>
        </div>
      ) : null}

      {localTab === 'resumo' ? (
        <>
          <div className={styles.kpiGrid}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Membros</span>
              <strong className={styles.kpiValue}>{stats?.memberCount ?? '—'}</strong>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Cidadãos cadastrados</span>
              <strong className={styles.kpiValue}>
                {stats?.citizenCount ?? '—'}
              </strong>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Ocorrências</span>
              <strong className={styles.kpiValue}>
                {stats?.complaintCount ?? '—'}
              </strong>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Últimos 7 dias</span>
              <strong className={styles.kpiValue}>
                {stats?.complaintsLast7Days ?? '—'}
              </strong>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Taxa de resolvidas</span>
              <strong className={styles.kpiValue}>
                {formatPercent(stats?.resolutionRatePct)}
              </strong>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiLabel}>Tempo médio de resolução</span>
              <strong className={styles.kpiValue}>
                {formatDurationDays(stats?.avgResolutionDays)}
              </strong>
            </div>
          </div>

          {billing ? (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Comercial</h2>
              <p>
                <strong>{formatBrl(billing.total_monthly_brl)}</strong>/mês ·
                contrato {billing.contract_months} meses · total{' '}
                <strong>{formatBrl(billing.total_contract_brl)}</strong>
              </p>
              <p className={styles.muted}>
                População: {formatPopulation(billing.population)} (
                {populationSourceLabel(billing.population_source)})
              </p>
            </div>
          ) : null}

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>
              Saúde do cliente — {healthStatusLabel(health?.status)}
            </h2>
            {health ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Verificação</th>
                    <th>Estado</th>
                    <th>Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {health.checks.map((c) => (
                    <tr key={c.key}>
                      <td>{healthCheckLabel(c.key)}</td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            c.ok ? styles.badgeOk : styles.badgeWarn
                          }`}
                        >
                          {c.ok ? 'OK' : 'Pendente'}
                        </span>
                      </td>
                      <td>{healthCheckDetail(c.key, c.detail)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            <p className={styles.muted}>
              Malhas: bairros{' '}
              {coverage?.bairrosLoaded ? '✓' : '✗'} · setores{' '}
              {coverage?.setoresLoaded ? '✓' : '✗'}
            </p>
            <p className={styles.muted}>
              Criado em {formatDateTime(tenant.createdAt)}
            </p>
          </div>
        </>
      ) : null}

      {localTab === 'config' && canOperate ? (
        <div className={styles.card}>
          <label className={styles.field}>
            <span className={styles.label}>Nome</span>
            <input
              className={styles.input}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Slug</span>
            <input
              className={styles.input}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Status</span>
            <select
              className={styles.select}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={status === 'suspended' && !canAdmin}
            >
              <option value="trial">Trial</option>
              <option value="active">Ativo</option>
              {canAdmin ? <option value="suspended">Suspenso</option> : null}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Recalcular contrato (meses)</span>
            <select
              className={styles.select}
              value={contractMonths}
              onChange={(e) =>
                setContractMonths(Number(e.target.value) as 12 | 24 | 36)
              }
            >
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={36}>36</option>
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={chatEnabled}
              onChange={(e) => setChatEnabled(e.target.checked)}
            />
            Chat habilitado
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
            }}
          >
            <input
              type="checkbox"
              checked={missionsEnabled}
              onChange={(e) => setMissionsEnabled(e.target.checked)}
            />
            Missões habilitadas
          </label>
          <button
            type="button"
            className={styles.btnPrimary}
            style={{ marginTop: 16 }}
            disabled={saving}
            onClick={() => void handleSaveConfig()}
          >
            {saving ? 'A guardar…' : 'Guardar'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
