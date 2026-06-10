import L from 'leaflet'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import type { GeoFeatureCollection } from '../../api/admin/malhas'

type FitAreaBoundsProps = {
  geojson: GeoFeatureCollection | null
  propertyKey: string
  selectedCode: string | null
}

export function FitAreaBounds({
  geojson,
  propertyKey,
  selectedCode,
}: FitAreaBoundsProps) {
  const map = useMap()

  useEffect(() => {
    if (!selectedCode || !geojson?.features?.length) return

    const feature = geojson.features.find(
      (item) => String(item.properties?.[propertyKey] ?? '') === selectedCode
    )
    if (!feature) return

    const layer = L.geoJSON(feature as GeoJSON.GeoJsonObject)
    const bounds = layer.getBounds()
    if (!bounds.isValid()) return

    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 })
  }, [map, geojson, propertyKey, selectedCode])

  return null
}
