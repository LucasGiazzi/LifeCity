import { platformFetch } from './client'

export type MunicipalitySearchItem = {
  cd_mun: string
  nm_mun: string
  sigla_uf: string
  hasTenant: boolean
  population: number | null
  populationSource: string
  coverage: {
    bairrosLoaded: boolean
    setoresLoaded: boolean
  }
}

export async function searchMunicipalities(q: string, uf = 'SP') {
  const qs = new URLSearchParams({ q, uf })
  return platformFetch<{ items: MunicipalitySearchItem[] }>(
    `/municipalities/search?${qs}`
  )
}
