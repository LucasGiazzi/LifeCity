import { adminFetch } from './client'

export type GeoFeatureCollection = {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    properties?: Record<string, unknown>
    geometry: {
      type: string
      coordinates: unknown
    }
  }>
}

export async function fetchMunicipioMalha(): Promise<GeoFeatureCollection> {
  return adminFetch<GeoFeatureCollection>('/malhas/municipio')
}

export async function fetchBairrosMalha(): Promise<GeoFeatureCollection> {
  return adminFetch<GeoFeatureCollection>('/malhas/bairros')
}

export async function fetchSetoresMalha(): Promise<GeoFeatureCollection> {
  return adminFetch<GeoFeatureCollection>('/malhas/setores')
}
