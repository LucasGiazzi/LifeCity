import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import type { GeoFeatureCollection } from '../../api/admin/malhas'
import L from 'leaflet'

type FitBoundsProps = {
  geojson: GeoFeatureCollection | null
}

export function FitBounds({ geojson }: FitBoundsProps) {
  const map = useMap()

  useEffect(() => {
    if (!geojson?.features?.length) return
    const layer = L.geoJSON(geojson as GeoJSON.GeoJsonObject)
    const bounds = layer.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [24, 24] })
    }
  }, [geojson, map])

  return null
}
