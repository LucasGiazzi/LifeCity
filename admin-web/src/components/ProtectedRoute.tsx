import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function ProtectedRoute() {
  const { accessToken, canAccessAdmin } = useAuth()

  if (!accessToken || !canAccessAdmin) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
