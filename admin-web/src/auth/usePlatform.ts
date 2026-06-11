import { useContext } from 'react'
import { PlatformContext } from './platform-context'

export function usePlatform() {
  const ctx = useContext(PlatformContext)
  if (!ctx) {
    throw new Error('usePlatform deve ser usado dentro de PlatformProvider')
  }
  return ctx
}
