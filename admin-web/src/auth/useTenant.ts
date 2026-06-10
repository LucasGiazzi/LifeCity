import { useContext } from 'react'
import { TenantContext } from './tenant-context'

export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) {
    throw new Error('useTenant deve ser usado dentro de TenantProvider')
  }
  return ctx
}
