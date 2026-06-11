import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { usePlatform } from '../../auth/usePlatform'
import { fetchBillingEstimate } from '../../api/platform/billing'
import type { BillingEstimate } from '../../api/platform/billing'
import { searchMunicipalities } from '../../api/platform/municipalities'
import type { MunicipalitySearchItem } from '../../api/platform/municipalities'
import { createTenant } from '../../api/platform/tenants'
import type { InvitationResult } from '../../api/platform/tenants'
import { CopySetupLink } from '../../components/platform/CopySetupLink'
import { formatBrl, formatPopulation, tenantStatusLabel } from '../../utils/format'
import styles from './platformPage.module.css'

const STEPS = [
  'Município',
  'Identidade',
  'Comercial',
  'Funcionalidades',
  'Convite',
  'Revisão',
] as const

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function TenantOnboardingPage() {
  const { canOperate } = usePlatform()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [munQuery, setMunQuery] = useState('')
  const [munResults, setMunResults] = useState<MunicipalitySearchItem[]>([])
  const [selectedMun, setSelectedMun] = useState<MunicipalitySearchItem | null>(
    null
  )

  const [slug, setSlug] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [status, setStatus] = useState<'trial' | 'active'>('trial')

  const [contractMonths, setContractMonths] = useState<12 | 24 | 36>(24)
  const [populationOverride, setPopulationOverride] = useState('')
  const [billing, setBilling] = useState<BillingEstimate | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)

  const [chatEnabled, setChatEnabled] = useState(true)
  const [missionsEnabled, setMissionsEnabled] = useState(false)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')

  const [createdInvitation, setCreatedInvitation] =
    useState<InvitationResult | null>(null)

  useEffect(() => {
    if (munQuery.trim().length < 2) {
      setMunResults([])
      return
    }
    const timer = setTimeout(() => {
      void searchMunicipalities(munQuery.trim())
        .then((r) => setMunResults(r.items))
        .catch(() => setMunResults([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [munQuery])

  useEffect(() => {
    if (!selectedMun) return
    setBillingLoading(true)
    const pop =
      populationOverride.trim() !== ''
        ? Number(populationOverride)
        : undefined
    void fetchBillingEstimate({
      cd_mun: selectedMun.cd_mun,
      contractMonths,
      populationOverride: pop,
    })
      .then(setBilling)
      .catch(() => setBilling(null))
      .finally(() => setBillingLoading(false))
  }, [selectedMun, contractMonths, populationOverride])

  function selectMunicipality(m: MunicipalitySearchItem) {
    if (m.hasTenant) {
      setError('Este município já possui cliente cadastrado.')
      return
    }
    setSelectedMun(m)
    setDisplayName(m.nm_mun)
    setSlug(slugify(m.nm_mun))
    setMunQuery(`${m.nm_mun} — ${m.sigla_uf}`)
    setMunResults([])
    setError(null)
  }

  function nextStep() {
    setError(null)
    if (step === 0 && !selectedMun) {
      setError('Selecione um município.')
      return
    }
    if (step === 1 && (!slug.trim() || !displayName.trim())) {
      setError('Slug e nome são obrigatórios.')
      return
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function prevStep() {
    setError(null)
    setStep((s) => Math.max(s - 1, 0))
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!selectedMun) return
    setSaving(true)
    setError(null)
    try {
      const result = await createTenant({
        cd_mun: selectedMun.cd_mun,
        slug: slug.trim().toLowerCase(),
        displayName: displayName.trim(),
        status,
        seedDefaults: true,
        settings: {
          features: {
            chat_enabled: chatEnabled,
            missions_enabled: missionsEnabled,
          },
        },
        billing: {
          contractMonths,
          populationOverride:
            populationOverride.trim() !== ''
              ? Number(populationOverride)
              : null,
        },
        inviteOwner: inviteEmail.trim()
          ? { email: inviteEmail.trim(), name: inviteName.trim() || undefined }
          : undefined,
      })

      if (result.invitation) {
        setCreatedInvitation(result.invitation)
      } else {
        navigate(`/platform/tenants/${result.tenant.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar cliente.')
    } finally {
      setSaving(false)
    }
  }

  const coverageWarning =
    selectedMun &&
    (!selectedMun.coverage.bairrosLoaded ||
      !selectedMun.coverage.setoresLoaded)

  if (!canOperate) {
    return <Navigate to="/platform/tenants" replace />
  }

  if (createdInvitation) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Cliente criado</h1>
        <div className={styles.card}>
          <p>O convite foi gerado. Copie o link e envie ao gestor municipal.</p>
          <CopySetupLink
            setupLink={createdInvitation.setupLink}
            emailSent={createdInvitation.emailSent}
          />
          <div className={styles.wizardNav}>
            <Link to="/platform/tenants" className={styles.btn}>
              Lista de clientes
            </Link>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => navigate('/platform/tenants')}
            >
              Concluir
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Novo cliente</h1>
          <p className={styles.subtitle}>Wizard de onboarding municipal</p>
        </div>
        <Link to="/platform/tenants" className={styles.btn}>
          Cancelar
        </Link>
      </header>

      <div className={styles.wizardSteps}>
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={
              i === step
                ? styles.wizardStepActive
                : i < step
                  ? styles.wizardStepDone
                  : styles.wizardStep
            }
          >
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <form className={styles.card} onSubmit={handleCreate}>
        {step === 0 ? (
          <>
            <label className={styles.field}>
              <span className={styles.label}>Buscar município (IBGE)</span>
              <input
                className={styles.input}
                value={munQuery}
                onChange={(e) => setMunQuery(e.target.value)}
                placeholder="Ex: Campinas"
              />
            </label>
            {munResults.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {munResults.map((m) => (
                  <li key={m.cd_mun}>
                    <button
                      type="button"
                      className={styles.btn}
                      style={{ width: '100%', marginBottom: 6, textAlign: 'left' }}
                      onClick={() => selectMunicipality(m)}
                    >
                      {m.nm_mun} — {m.sigla_uf} ({m.cd_mun})
                      {m.hasTenant ? ' · já cadastrado' : ''}
                      {m.population
                        ? ` · ${formatPopulation(m.population)} hab.`
                        : ''}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {selectedMun ? (
              <p className={styles.muted}>
                Selecionado: <strong>{selectedMun.nm_mun}</strong> (
                {selectedMun.cd_mun})
              </p>
            ) : null}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <label className={styles.field}>
              <span className={styles.label}>Slug</span>
              <input
                className={styles.input}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                pattern="[a-z0-9-]+"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Nome de exibição</span>
              <input
                className={styles.input}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Status inicial</span>
              <select
                className={styles.select}
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as 'trial' | 'active')
                }
              >
                <option value="trial">Trial</option>
                <option value="active">Ativo</option>
              </select>
            </label>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <label className={styles.field}>
              <span className={styles.label}>
                População{' '}
                {selectedMun?.populationSource === 'unknown'
                  ? '(informe manualmente)'
                  : ''}
              </span>
              <input
                className={styles.input}
                type="number"
                value={populationOverride}
                onChange={(e) => setPopulationOverride(e.target.value)}
                placeholder={
                  selectedMun?.population
                    ? String(selectedMun.population)
                    : 'População estimada'
                }
              />
            </label>
            <p className={styles.label}>Duração do contrato</p>
            <div className={styles.radioGroup}>
              {([12, 24, 36] as const).map((months) => (
                <button
                  key={months}
                  type="button"
                  className={`${styles.radioCard} ${
                    contractMonths === months ? styles.radioCardSelected : ''
                  }`}
                  onClick={() => setContractMonths(months)}
                >
                  <strong>{months} meses</strong>
                </button>
              ))}
            </div>
            {billingLoading ? (
              <p className={styles.muted}>A calcular estimativa…</p>
            ) : billing ? (
              <div className={styles.billingPreview}>
                <div className={styles.billingCard}>
                  <span className={styles.kpiLabel}>Mensal</span>
                  <div className={styles.billingValue}>
                    {formatBrl(billing.totalMonthlyBrl)}/mês
                  </div>
                  <small className={styles.muted}>
                    Base {formatBrl(billing.baseMonthlyBrl)} + Infra{' '}
                    {formatBrl(billing.infraMonthlyBrl)}
                  </small>
                </div>
                <div className={styles.billingCard}>
                  <span className={styles.kpiLabel}>Total contrato</span>
                  <div className={styles.billingValue}>
                    {formatBrl(billing.totalContractBrl)}
                  </div>
                  <small className={styles.muted}>{billing.disclaimer}</small>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <label className={styles.field}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={chatEnabled}
                  onChange={(e) => setChatEnabled(e.target.checked)}
                />
                Chat cidadão ↔ prefeitura habilitado
              </label>
            </label>
            <label className={styles.field}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={missionsEnabled}
                  onChange={(e) => setMissionsEnabled(e.target.checked)}
                />
                Missões habilitadas
              </label>
            </label>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <p className={styles.muted}>
              Opcional — cria conta e envia link para definir senha.
            </p>
            <label className={styles.field}>
              <span className={styles.label}>E-mail do gestor</span>
              <input
                className={styles.input}
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Nome do gestor</span>
              <input
                className={styles.input}
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </label>
          </>
        ) : null}

        {step === 5 ? (
          <>
            {coverageWarning ? (
              <div className={styles.warning} role="alert">
                Malhas incompletas para este município — o painel municipal
                pode funcionar parcialmente até importação das malhas.
              </div>
            ) : null}
            <p className={styles.muted}>
              A área geográfica será definida automaticamente a partir da malha
              IBGE do município.
            </p>
            <dl>
              <dt className={styles.label}>Município</dt>
              <dd>{selectedMun?.nm_mun} ({selectedMun?.cd_mun})</dd>
              <dt className={styles.label}>Identidade</dt>
              <dd>
                {displayName} · {slug} · {tenantStatusLabel(status)}
              </dd>
              <dt className={styles.label}>Comercial</dt>
              <dd>
                {contractMonths} meses ·{' '}
                {billing
                  ? `${formatBrl(billing.totalMonthlyBrl)}/mês · total ${formatBrl(billing.totalContractBrl)}`
                  : '—'}
              </dd>
              {inviteEmail ? (
                <>
                  <dt className={styles.label}>Convite</dt>
                  <dd>{inviteEmail}</dd>
                </>
              ) : null}
            </dl>
          </>
        ) : null}

        <div className={styles.wizardNav}>
          <button
            type="button"
            className={styles.btn}
            disabled={step === 0}
            onClick={prevStep}
          >
            Anterior
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" className={styles.btnPrimary} onClick={nextStep}>
              Seguinte
            </button>
          ) : (
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={saving}
            >
              {saving ? 'A criar…' : 'Confirmar e criar'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
