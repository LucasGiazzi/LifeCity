import L from 'leaflet'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import type { BaseLayerDefinition } from './baseLayers'

type MapBaseLayerProps = {
  layer: BaseLayerDefinition
}

/**
 * Troca a camada base sem remontar <TileLayer /> — evita crash do react-leaflet
 * ao alternar providers (ex.: OSM → Esri satélite).
 */
export function MapBaseLayer({ layer }: MapBaseLayerProps) {
  const map = useMap()

  useEffect(() => {
    const options: L.TileLayerOptions = {
      attribution: layer.attribution,
      maxZoom: layer.maxZoom ?? 19,
    }

    if (layer.subdomains) {
      options.subdomains = layer.subdomains
    }

    if (layer.detectRetina) {
      options.detectRetina = true
    }

    const tileLayer = L.tileLayer(layer.url, options)
    tileLayer.addTo(map)
    tileLayer.bringToBack()

    return () => {
      map.removeLayer(tileLayer)
    }
  }, [
    map,
    layer.id,
    layer.url,
    layer.attribution,
    layer.subdomains,
    layer.maxZoom,
    layer.detectRetina,
  ])

  return null
}
