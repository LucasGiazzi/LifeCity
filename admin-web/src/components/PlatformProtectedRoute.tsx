import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function PlatformProtectedRoute() {
  const { accessToken, canAccessAdmin, platformRole } = useAuth()

  if (!accessToken || !canAccessAdmin) {
    return <Navigate to="/login" replace />
  }

  if (!platformRole) {
    return <Navigate to="/admin" replace />
  }

  return <Outlet />
}
