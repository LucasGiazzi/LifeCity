import { platformFetch } from './client'

export type BillingEstimate = {
  population: number
  populationSource: string
  baseMonthlyBrl: number
  infraMonthlyBrl: number
  totalMonthlyBrl: number
  contractMonths: 12 | 24 | 36
  totalContractBrl: number
  disclaimer: string
}

export async function fetchBillingEstimate(params: {
  cd_mun: string
  contractMonths: 12 | 24 | 36
  populationOverride?: number
}) {
  const qs = new URLSearchParams({
    cd_mun: params.cd_mun,
    contractMonths: String(params.contractMonths),
  })
  if (params.populationOverride != null) {
    qs.set('populationOverride', String(params.populationOverride))
  }
  return platformFetch<BillingEstimate>(`/billing/estimate?${qs}`)
}
