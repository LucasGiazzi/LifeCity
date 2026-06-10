import type { PathOptions } from 'leaflet'
import { GeoJSON } from 'react-leaflet'
import type { ComplaintPoint } from '../../api/admin/complaints'
import type { GeoFeatureCollection } from '../../api/admin/malhas'
import { ComplaintMarkerCluster } from './ComplaintMarkerCluster'

const MUN_STYLE = {
  color: '#162D1F',
  weight: 2,
  fillColor: '#2563eb',
  fillOpacity: 0.1,
}

const BAIRRO_STYLE: PathOptions = {
  color: '#16a34a',
  weight: 1.5,
  fillColor: '#16a34a',
  fillOpacity: 0.05,
}

const BAIRRO_SELECTED_STYLE: PathOptions = {
  color: '#15803d',
  weight: 3,
  fillColor: '#16a34a',
  fillOpacity: 0.38,
}

const BAIRRO_DIMMED_STYLE: PathOptions = {
  color: '#16a34a',
  weight: 1,
  fillColor: '#16a34a',
  fillOpacity: 0.02,
}

const SETOR_STYLE: PathOptions = {
  color: '#9333ea',
  weight: 1,
  fillColor: '#9333ea',
  fillOpacity: 0.05,
}

const SETOR_SELECTED_STYLE: PathOptions = {
  color: '#7e22ce',
  weight: 3,
  fillColor: '#9333ea',
  fillOpacity: 0.38,
}

const SETOR_DIMMED_STYLE: PathOptions = {
  color: '#9333ea',
  weight: 1,
  fillColor: '#9333ea',
  fillOpacity: 0.02,
}

export type MeshDivision = 'bairros' | 'setores' | null

type DashboardMapProps = {
  municipio: GeoFeatureCollection | null
  bairros: GeoFeatureCollection | null
  setores: GeoFeatureCollection | null
  complaints: ComplaintPoint[]
  meshDivision: MeshDivision
  selectedSetor: string | null
  selectedBairro: string | null
  onSelectSetor?: (code: string) => void
  onSelectBairro?: (code: string) => void
}

function areaStyle(
  code: string | undefined,
  selectedCode: string | null,
  base: PathOptions,
  selected: PathOptions,
  dimmed: PathOptions
): PathOptions {
  if (!selectedCode) return base
  if (code === selectedCode) return selected
  return dimmed
}

function setorStyle(
  cdSetor: string | undefined,
  selectedSetor: string | null
): PathOptions {
  return areaStyle(
    cdSetor,
    selectedSetor,
    SETOR_STYLE,
    SETOR_SELECTED_STYLE,
    SETOR_DIMMED_STYLE
  )
}

function bairroStyle(
  cdBairro: string | undefined,
  selectedBairro: string | null
): PathOptions {
  return areaStyle(
    cdBairro,
    selectedBairro,
    BAIRRO_STYLE,
    BAIRRO_SELECTED_STYLE,
    BAIRRO_DIMMED_STYLE
  )
}

export function DashboardMap({
  municipio,
  bairros,
  setores,
  complaints,
  meshDivision,
  selectedSetor,
  selectedBairro,
  onSelectSetor,
  onSelectBairro,
}: DashboardMapProps) {
  return (
    <>
      {municipio?.features?.length ? (
        <GeoJSON data={municipio as GeoJSON.GeoJsonObject} style={MUN_STYLE} />
      ) : null}
      {meshDivision === 'bairros' && bairros?.features?.length ? (
        <GeoJSON
          key={`bairros-${selectedBairro ?? 'all'}`}
          data={bairros as GeoJSON.GeoJsonObject}
          style={(feature) =>
            bairroStyle(
              String(feature?.properties?.cd_bairro ?? ''),
              selectedBairro
            )
          }
          onEachFeature={(feature, layer) => {
            const cdBairro = String(feature?.properties?.cd_bairro ?? '')
            if (!cdBairro || !onSelectBairro) return
            layer.on('click', () => onSelectBairro(cdBairro))
          }}
        />
      ) : null}
      {meshDivision === 'setores' && setores?.features?.length ? (
        <GeoJSON
          key={`setores-${selectedSetor ?? 'all'}`}
          data={setores as GeoJSON.GeoJsonObject}
          style={(feature) =>
            setorStyle(
              String(feature?.properties?.cd_setor ?? ''),
              selectedSetor
            )
          }
          onEachFeature={(feature, layer) => {
            const cdSetor = String(feature?.properties?.cd_setor ?? '')
            if (!cdSetor || !onSelectSetor) return
            layer.on('click', () => onSelectSetor(cdSetor))
          }}
        />
      ) : null}
      <ComplaintMarkerCluster complaints={complaints} />
    </>
  )
}

export { MUN_STYLE, BAIRRO_STYLE, SETOR_STYLE }
