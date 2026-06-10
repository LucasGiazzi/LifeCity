export type BaseLayerId = 'streets' | 'satellite' | 'light' | 'topo'

export type BaseLayerDefinition = {
  id: BaseLayerId
  name: string
  url: string
  attribution: string
  previewUrl: string
  subdomains?: string
  maxZoom?: number
  detectRetina?: boolean
}

/** Tile estático (z/x/y) sobre Campinas — usado só como miniatura de preview. */
const PREVIEW = {
  z: 11,
  x: 756,
  y: 1158,
} as const

function previewUrl(template: string, subdomains = 'a'): string {
  const url = template
    .replace('{s}', subdomains[0] ?? 'a')
    .replace('{z}', String(PREVIEW.z))
    .replace('{x}', String(PREVIEW.x))
    .replace('{y}', String(PREVIEW.y))
    .replace('{r}', '')
  return url
}

export const BASE_LAYERS: BaseLayerDefinition[] = [
  {
    id: 'streets',
    name: 'Ruas',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    previewUrl: previewUrl(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    ),
    subdomains: 'abc',
  },
  {
    id: 'satellite',
    name: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    previewUrl: previewUrl(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    ),
    maxZoom: 19,
  },
  {
    id: 'light',
    name: 'Claro',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    previewUrl: previewUrl(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    ),
    subdomains: 'abcd',
    detectRetina: true,
  },
  {
    id: 'topo',
    name: 'Topográfico',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    previewUrl: previewUrl(
      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
    ),
    subdomains: 'abc',
  },
]

export const DEFAULT_BASE_LAYER_ID: BaseLayerId = 'streets'

export function getBaseLayer(id: BaseLayerId): BaseLayerDefinition {
  return BASE_LAYERS.find((l) => l.id === id) ?? BASE_LAYERS[0]
}
