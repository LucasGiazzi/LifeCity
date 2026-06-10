import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapContainer } from 'react-leaflet'

import { useAuth } from '../auth/useAuth'
import { useTenant } from '../auth/useTenant'
import {
  fetchAnalyticsByCategory,
  fetchAnalyticsRanking,
  fetchAnalyticsSummary,
  type AnalyticsSummary,
  type CategoryItem,
} from '../api/admin/analytics'
import { fetchAdminComplaints, type ComplaintPoint } from '../api/admin/complaints'
import {
  fetchBairrosMalha,
  fetchMunicipioMalha,
  fetchSetoresMalha,
  type GeoFeatureCollection,
} from '../api/admin/malhas'
import { BaseLayerPicker } from '../components/dashboard/BaseLayerPicker'
import {
  DEFAULT_BASE_LAYER_ID,
  getBaseLayer,
  type BaseLayerId,
} from '../components/dashboard/baseLayers'
import { CategoryChart } from '../components/dashboard/CategoryChart'
import { DashboardMap, type MeshDivision } from '../components/dashboard/DashboardMap'
import { FitBounds } from '../components/dashboard/FitBounds'
import { FitAreaBounds } from '../components/dashboard/FitAreaBounds'
import { KpiCards } from '../components/dashboard/KpiCards'
import { OpsKpiCards } from '../components/operations/OpsKpiCards'
import { MapBaseLayer } from '../components/dashboard/MapBaseLayer'
import { MeshLayerToggles } from '../components/dashboard/MeshLayerToggles'
import {
  SetorRankingChart,
  type AreaRankingMode,
} from '../components/dashboard/SetorRankingChart'
import {
  buildAreaLabelMaps,
  computeBairroRanking,
  computeCategoryBreakdown,
  computeSetorRanking,
  computeSummaryFromComplaints,
  filterComplaintsByBairro,
  filterComplaintsByCategory,
  filterComplaintsBySetor,
} from '../utils/dashboardAnalytics'
import styles from './DashboardPage.module.css'

const DEFAULT_CENTER: [number, number] = [-22.9099, -47.0626]

type AreaFilter = {
  type: 'setor' | 'bairro'
  code: string
} | null

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
  const [areaRanking, setAreaRanking] = useState<{
    bySetor: { code: string; label: string; count: number }[]
    byBairro: { code: string; label: string; count: number }[]
  }>({ bySetor: [], byBairro: [] })
  const [meshDivision, setMeshDivision] = useState<MeshDivision>(null)
  const [selectedArea, setSelectedArea] = useState<AreaFilter>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [rankingMode, setRankingMode] = useState<AreaRankingMode>('bairro')
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
      setAreaRanking(rankingData)
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

  useEffect(() => {
    setSelectedArea(null)
    setSelectedCategory(null)
    setMeshDivision(null)
  }, [activeTenantId])

  const labelMaps = useMemo(
    () => buildAreaLabelMaps(areaRanking),
    [areaRanking]
  )

  const hasBairroData = useMemo(
    () =>
      areaRanking.byBairro.length > 0 ||
      complaints.some((complaint) => Boolean(complaint.cd_bairro)),
    [areaRanking.byBairro.length, complaints]
  )

  useEffect(() => {
    setRankingMode(hasBairroData ? 'bairro' : 'setor')
  }, [activeTenantId, hasBairroData])

  const areaFilteredComplaints = useMemo(() => {
    if (!selectedArea) return complaints
    if (selectedArea.type === 'setor') {
      return filterComplaintsBySetor(complaints, selectedArea.code)
    }
    return filterComplaintsByBairro(complaints, selectedArea.code)
  }, [complaints, selectedArea])

  const displayComplaints = useMemo(() => {
    if (!selectedCategory) return areaFilteredComplaints
    return filterComplaintsByCategory(areaFilteredComplaints, selectedCategory)
  }, [areaFilteredComplaints, selectedCategory])

  const complaintsForRanking = useMemo(() => {
    if (!selectedCategory) return complaints
    return filterComplaintsByCategory(complaints, selectedCategory)
  }, [complaints, selectedCategory])

  const displaySummary = useMemo(() => {
    if (!summary) return null
    if (!selectedArea && !selectedCategory) return summary
    return {
      ...summary,
      ...computeSummaryFromComplaints(displayComplaints),
    }
  }, [summary, selectedArea, selectedCategory, displayComplaints])

  const displayCategories = useMemo(() => {
    if (selectedArea) {
      return computeCategoryBreakdown(areaFilteredComplaints)
    }
    if (selectedCategory) {
      return categories
    }
    return categories
  }, [selectedArea, selectedCategory, areaFilteredComplaints, categories])

  const setorRanking = useMemo(
    () => computeSetorRanking(complaintsForRanking, labelMaps.setor),
    [complaintsForRanking, labelMaps.setor]
  )

  const bairroRanking = useMemo(
    () => computeBairroRanking(complaintsForRanking, labelMaps.bairro),
    [complaintsForRanking, labelMaps.bairro]
  )

  const activeRankingItems =
    rankingMode === 'bairro' ? bairroRanking : setorRanking

  const selectedAreaCode =
    selectedArea?.type === rankingMode ? selectedArea.code : null

  const handleSelectCategory = useCallback((slug: string) => {
    setSelectedCategory((current) => (current === slug ? null : slug))
  }, [])

  const handleSelectArea = useCallback(
    (code: string) => {
      setSelectedArea((current) => {
        if (current?.code === code && current.type === rankingMode) {
          return null
        }

        if (rankingMode === 'setor') {
          setMeshDivision('setores')
        } else {
          setMeshDivision('bairros')
        }

        return { type: rankingMode, code }
      })
    },
    [rankingMode]
  )

  const handleRankingModeChange = useCallback((mode: AreaRankingMode) => {
    setRankingMode(mode)
    setSelectedArea(null)
    setMeshDivision(null)
  }, [])

  const handleClearArea = useCallback(() => {
    setSelectedArea(null)
  }, [])

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
  const markersCount = displayComplaints.filter(
    (c) => c.latitude != null && c.longitude != null
  ).length
  const baseLayer = getBaseLayer(baseLayerId)

  const filterParts: string[] = []
  if (selectedCategory) {
    const categoryItem = categories.find((item) => item.slug === selectedCategory)
    filterParts.push(categoryItem?.name ?? selectedCategory)
  }
  if (selectedArea?.type === 'setor') {
    filterParts.push(`Setor ${selectedArea.code}`)
  }
  if (selectedArea?.type === 'bairro') {
    const label =
      labelMaps.bairro[selectedArea.code] ?? `Bairro ${selectedArea.code}`
    filterParts.push(label)
  }
  const filterLabel = filterParts.length > 0 ? filterParts.join(' · ') : null

  const selectedSetorForMap =
    selectedArea?.type === 'setor' ? selectedArea.code : null

  const selectedBairroForMap =
    selectedArea?.type === 'bairro' ? selectedArea.code : null

  const areasLoaded =
    rankingMode === 'bairro'
      ? summary?.coverage.bairrosLoaded ?? hasBairroData
      : summary?.coverage.setoresLoaded ?? false

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
                complaints={displayComplaints}
                meshDivision={meshDivision}
                selectedSetor={selectedSetorForMap}
                selectedBairro={selectedBairroForMap}
                onSelectSetor={(code) => {
                  setRankingMode('setor')
                  setMeshDivision('setores')
                  setSelectedArea((current) =>
                    current?.type === 'setor' && current.code === code
                      ? null
                      : { type: 'setor', code }
                  )
                }}
                onSelectBairro={(code) => {
                  setRankingMode('bairro')
                  setMeshDivision('bairros')
                  setSelectedArea((current) =>
                    current?.type === 'bairro' && current.code === code
                      ? null
                      : { type: 'bairro', code }
                  )
                }}
              />
              <FitBounds geojson={municipio} />
              <FitAreaBounds
                geojson={setores}
                propertyKey="cd_setor"
                selectedCode={selectedSetorForMap}
              />
              <FitAreaBounds
                geojson={bairros}
                propertyKey="cd_bairro"
                selectedCode={selectedBairroForMap}
              />
            </MapContainer>
            <BaseLayerPicker
              activeId={baseLayerId}
              onChange={setBaseLayerId}
            />
            <MeshLayerToggles
              meshDivision={meshDivision}
              onMeshDivisionChange={setMeshDivision}
              bairrosAvailable={bairrosAvailable}
              setoresAvailable={setoresAvailable}
            />
            {filterLabel ? (
              <div className={styles.mapFilterBadge}>
                {filterLabel}
                <button
                  type="button"
                  className={styles.mapFilterClear}
                  onClick={() => {
                    setSelectedArea(null)
                    setSelectedCategory(null)
                  }}
                  aria-label="Limpar filtros"
                >
                  ×
                </button>
              </div>
            ) : null}
            {!loading && markersCount === 0 ? (
              <p className={styles.mapEmpty}>
                {filterLabel
                  ? 'Nenhuma ocorrência com os filtros aplicados'
                  : 'Nenhuma reclamação no período'}
              </p>
            ) : null}
          </div>
        </section>

        <section className={styles.analyticsPane}>
          <KpiCards
            summary={displaySummary}
            loading={loading}
            filterLabel={filterLabel}
          />
          <OpsKpiCards summary={summary} loading={loading} />
          <CategoryChart
            items={displayCategories}
            loading={loading}
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
          />
          <SetorRankingChart
            items={activeRankingItems}
            mode={rankingMode}
            onModeChange={handleRankingModeChange}
            canToggleMode={hasBairroData}
            selectedCode={selectedAreaCode}
            areasLoaded={areasLoaded}
            loading={loading}
            onSelectArea={handleSelectArea}
            onClearSelection={handleClearArea}
          />
        </section>
      </div>
    </div>
  )
}
