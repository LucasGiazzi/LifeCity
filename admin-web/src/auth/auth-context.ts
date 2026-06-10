import { createContext } from 'react'
import type { AdminUser } from '../api/auth'

export type AuthContextValue = {
  accessToken: string | null
  user: AdminUser | null
  /** Nota: apenas UX; APIs administrativas devem validar nível no servidor. */
  canAccessAdmin: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setUserFromMe: (user: AdminUser) => void
  updateAccessToken: (token: string) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
