import { CircleMarker, GeoJSON, Popup } from 'react-leaflet'
import type { ComplaintPoint } from '../../api/admin/complaints'
import type { GeoFeatureCollection } from '../../api/admin/malhas'
import { complaintMarkerColor } from '../../catalog/categoryUtils'
import { useCategories } from '../../catalog/CategoriesContext'
import {
  COMPLAINT_POPUP_CLASS,
  ComplaintMapPopup,
} from './ComplaintMapPopup'

const MUN_STYLE = {
  color: '#162D1F',
  weight: 2,
  fillColor: '#2563eb',
  fillOpacity: 0.1,
}

const BAIRRO_STYLE = {
  color: '#16a34a',
  weight: 1.5,
  fillColor: '#16a34a',
  fillOpacity: 0.05,
}

const SETOR_STYLE = {
  color: '#9333ea',
  weight: 1,
  fillColor: '#9333ea',
  fillOpacity: 0.05,
}

type DashboardMapProps = {
  municipio: GeoFeatureCollection | null
  bairros: GeoFeatureCollection | null
  setores: GeoFeatureCollection | null
  complaints: ComplaintPoint[]
  showBairros: boolean
  showSetores: boolean
}

export function DashboardMap({
  municipio,
  bairros,
  setores,
  complaints,
  showBairros,
  showSetores,
}: DashboardMapProps) {
  const { resolve } = useCategories()
  const markers = complaints.filter(
    (c) => c.latitude != null && c.longitude != null
  )

  return (
    <>
      {municipio?.features?.length ? (
        <GeoJSON data={municipio as GeoJSON.GeoJsonObject} style={MUN_STYLE} />
      ) : null}
      {showBairros && bairros?.features?.length ? (
        <GeoJSON data={bairros as GeoJSON.GeoJsonObject} style={BAIRRO_STYLE} />
      ) : null}
      {showSetores && setores?.features?.length ? (
        <GeoJSON data={setores as GeoJSON.GeoJsonObject} style={SETOR_STYLE} />
      ) : null}
      {markers.map((c) => {
        const catalog = resolve(c.category)
        const fillColor = complaintMarkerColor(
          c.category_color,
          catalog?.colorHex
        )
        return (
        <CircleMarker
          key={c.id}
          center={[c.latitude!, c.longitude!]}
          radius={7}
          pathOptions={{
            color: '#0d2818',
            fillColor,
            fillOpacity: 0.85,
            weight: 1,
          }}
        >
          <Popup
            className={COMPLAINT_POPUP_CLASS}
            minWidth={280}
            maxWidth={300}
          >
            <ComplaintMapPopup complaint={c} />
          </Popup>
        </CircleMarker>
        )
      })}
    </>
  )
}

export { MUN_STYLE, BAIRRO_STYLE, SETOR_STYLE }
