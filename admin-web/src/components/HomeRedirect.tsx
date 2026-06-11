import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function HomeRedirect() {
  const { accessToken, canAccessAdmin, platformRole } = useAuth()

  if (!accessToken || !canAccessAdmin) {
    return <Navigate to="/login" replace />
  }

  if (platformRole) {
    return <Navigate to="/platform" replace />
  }

  return <Navigate to="/admin" replace />
}
