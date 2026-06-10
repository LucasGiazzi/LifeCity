import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { TenantProvider } from './auth/TenantContext'
import { CategoriesProvider } from './catalog/CategoriesContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminLayout } from './layout/AdminLayout'
import { AccountPage } from './pages/AccountPage'
import { ComplaintDetailPage } from './pages/ComplaintDetailPage'
import { DashboardPage } from './pages/DashboardPage'
import { InboxPage } from './pages/InboxPage'
import { LoginPage } from './pages/LoginPage'
import { ModerationPage } from './pages/ModerationPage'
import { OpsTeamsPage } from './pages/OpsTeamsPage'
import { SlaSettingsPage } from './pages/SlaSettingsPage'

export default function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <CategoriesProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<DashboardPage />} />
                  <Route path="/admin/inbox" element={<InboxPage />} />
                  <Route path="/admin/teams" element={<OpsTeamsPage />} />
                  <Route path="/admin/settings/sla" element={<SlaSettingsPage />} />
                  <Route path="/admin/moderation" element={<ModerationPage />} />
                  <Route path="/admin/complaints/:id" element={<ComplaintDetailPage />} />
                  <Route path="/admin/account" element={<AccountPage />} />
                </Route>
              </Route>
              <Route path="/" element={<Navigate to="/admin" replace />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </BrowserRouter>
        </CategoriesProvider>
      </TenantProvider>
    </AuthProvider>
  )
}
