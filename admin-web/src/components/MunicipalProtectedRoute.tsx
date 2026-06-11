import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useTenant } from '../auth/useTenant'
import { usePlatform } from '../auth/usePlatform'

export function MunicipalProtectedRoute() {
  const { accessToken, canAccessAdmin } = useAuth()
  const { hasTenantAccess } = useTenant()
  const { isImpersonating } = usePlatform()

  if (!accessToken || !canAccessAdmin) {
    return <Navigate to="/login" replace />
  }

  if (!hasTenantAccess && !isImpersonating) {
    return <Navigate to="/platform" replace />
  }

  return <Outlet />
}
