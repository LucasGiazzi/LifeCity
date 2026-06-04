import { useCallback, useEffect, useState } from 'react'
import { MapContainer } from 'react-leaflet'
import { useAuth } from '../auth/useAuth'
import { useTenant } from '../auth/useTenant'
import {
  fetchAnalyticsByCategory,
  fetchAnalyticsRanking,
  fetchAnalyticsSummary,
  type AnalyticsSummary,
  type AreaRankItem,
  type CategoryItem,
} from '../api/admin/analytics'
import { fetchAdminComplaints, type ComplaintPoint } from '../api/admin/complaints'
import {
  fetchBairrosMalha,
  fetchMunicipioMalha,
  fetchSetoresMalha,
  type GeoFeatureCollection,
} from '../api/admin/malhas'
import { AreaRanking } from '../components/dashboard/AreaRanking'
import { BaseLayerPicker } from '../components/dashboard/BaseLayerPicker'
import {
  DEFAULT_BASE_LAYER_ID,
  getBaseLayer,
  type BaseLayerId,
} from '../components/dashboard/baseLayers'
import { CategoryChart } from '../components/dashboard/CategoryChart'
import { DashboardMap } from '../components/dashboard/DashboardMap'
import { FitBounds } from '../components/dashboard/FitBounds'
import { MapBaseLayer } from '../components/dashboard/MapBaseLayer'
import { KpiCards } from '../components/dashboard/KpiCards'
import { MeshLayerToggles } from '../components/dashboard/MeshLayerToggles'
import styles from './DashboardPage.module.css'

const DEFAULT_CENTER: [number, number] = [-22.9099, -47.0626]

export function DashboardPage() {
  const { user, logout } = useAuth()
  const {
    tenants,
    activeTenant,
    activeTenantId,
    hasTenantAccess,
    isSwitching,
    switchTenant,
  } = useTenant()

  const [municipio, setMunicipio] = useState<GeoFeatureCollection | null>(null)
  const [bairros, setBairros] = useState<GeoFeatureCollection | null>(null)
  const [setores, setSetores] = useState<GeoFeatureCollection | null>(null)
  const [complaints, setComplaints] = useState<ComplaintPoint[]>([])
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [rankSetor, setRankSetor] = useState<AreaRankItem[]>([])
  const [rankBairro, setRankBairro] = useState<AreaRankItem[]>([])
  const [showBairros, setShowBairros] = useState(false)
  const [showSetores, setShowSetores] = useState(false)
  const [baseLayerId, setBaseLayerId] = useState<BaseLayerId>(DEFAULT_BASE_LAYER_ID)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    if (!hasTenantAccess) return

    setLoading(true)
    setError(null)
    try {
      const [
        municipioData,
        bairrosData,
        setoresData,
        complaintsData,
        summaryData,
        categoryData,
        rankingData,
      ] = await Promise.all([
        fetchMunicipioMalha(),
        fetchBairrosMalha(),
        fetchSetoresMalha(),
        fetchAdminComplaints(),
        fetchAnalyticsSummary(),
        fetchAnalyticsByCategory(),
        fetchAnalyticsRanking(),
      ])

      setMunicipio(municipioData)
      setBairros(bairrosData)
      setSetores(setoresData)
      setComplaints(complaintsData)
      setSummary(summaryData)
      setCategories(categoryData)
      setRankSetor(rankingData.bySetor)
      setRankBairro(rankingData.byBairro)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao carregar dashboard.'
      )
    } finally {
      setLoading(false)
    }
  }, [hasTenantAccess])

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return
      void loadDashboard()
    })

    return () => {
      cancelled = true
    }
  }, [loadDashboard, activeTenantId])

  if (!hasTenantAccess) {
    return (
      <div className={styles.noTenant}>
        <h1>Sem município vinculado</h1>
        <p>
          A sua conta tem nível administrativo, mas não está associada a nenhum
          município ativo. Contacte o suporte LifeCity.
        </p>
      </div>
    )
  }

  const bairrosAvailable = Boolean(bairros?.features?.length)
  const setoresAvailable = Boolean(setores?.features?.length)
  const markersCount = complaints.filter(
    (c) => c.latitude != null && c.longitude != null
  ).length
  const baseLayer = getBaseLayer(baseLayerId)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logoMark}>LC</span>
          {tenants.length > 1 ? (
            <select
              className={styles.tenantSelect}
              value={activeTenantId ?? ''}
              disabled={isSwitching}
              onChange={(e) => void switchTenant(e.target.value)}
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName}
                </option>
              ))}
            </select>
          ) : (
            <span className={styles.tenantName}>
              {activeTenant?.displayName ?? 'Município'}
            </span>
          )}
        </div>
        <div className={styles.headerRight}>
          {summary && !summary.coverage.setoresLoaded ? (
            <span
              className={styles.coverageBadge}
              title="Malha de setores em carga"
            >
              Setores parciais
            </span>
          ) : null}
          <span className={styles.userName}>{user?.name}</span>
          <button type="button" className={styles.logoutBtn} onClick={logout}>
            Sair
          </button>
        </div>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.split}>
        <section className={styles.mapPane}>
          <div className={styles.mapWrap}>
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={11}
              className={styles.map}
              scrollWheelZoom
            >
              <MapBaseLayer layer={baseLayer} />
              <DashboardMap
                municipio={municipio}
                bairros={bairros}
                setores={setores}
                complaints={complaints}
                showBairros={showBairros}
                showSetores={showSetores}
              />
              <FitBounds geojson={municipio} />
            </MapContainer>
            <BaseLayerPicker
              activeId={baseLayerId}
              onChange={setBaseLayerId}
            />
            <MeshLayerToggles
              showBairros={showBairros}
              showSetores={showSetores}
              onToggleBairros={setShowBairros}
              onToggleSetores={setShowSetores}
              bairrosAvailable={bairrosAvailable}
              setoresAvailable={setoresAvailable}
            />
            {!loading && markersCount === 0 ? (
              <p className={styles.mapEmpty}>Nenhuma reclamação no período</p>
            ) : null}
          </div>
        </section>

        <section className={styles.analyticsPane}>
          <KpiCards summary={summary} loading={loading} />
          <CategoryChart items={categories} loading={loading} />
          <AreaRanking
            bySetor={rankSetor}
            byBairro={rankBairro}
            setoresLoaded={summary?.coverage.setoresLoaded ?? false}
            bairrosLoaded={summary?.coverage.bairrosLoaded ?? false}
            loading={loading}
          />
          <div className={styles.reserved}>
            <p>Área reservada para expansão</p>
          </div>
        </section>
      </div>
    </div>
  )
}
