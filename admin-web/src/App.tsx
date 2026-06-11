import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { PlatformProvider } from './auth/PlatformContext'
import { TenantProvider } from './auth/TenantContext'
import { CategoriesProvider } from './catalog/CategoriesContext'
import { HomeRedirect } from './components/HomeRedirect'
import { MunicipalProtectedRoute } from './components/MunicipalProtectedRoute'
import { PlatformProtectedRoute } from './components/PlatformProtectedRoute'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminLayout } from './layout/AdminLayout'
import { PlatformLayout } from './layout/PlatformLayout'
import { AcceptInvitePage } from './pages/AcceptInvitePage'
import { AccountPage } from './pages/AccountPage'
import { ComplaintDetailPage } from './pages/ComplaintDetailPage'
import { DashboardPage } from './pages/DashboardPage'
import { InboxPage } from './pages/InboxPage'
import { LoginPage } from './pages/LoginPage'
import { ModerationPage } from './pages/ModerationPage'
import { OpsTeamsPage } from './pages/OpsTeamsPage'
import { SlaSettingsPage } from './pages/SlaSettingsPage'
import { AuditLogPage } from './pages/platform/AuditLogPage'
import { PlatformDashboardPage } from './pages/platform/PlatformDashboardPage'
import { PlatformStaffPage } from './pages/platform/PlatformStaffPage'
import { TenantDetailPage } from './pages/platform/TenantDetailPage'
import { TenantCitizensPage } from './pages/platform/TenantCitizensPage'
import { TenantMembersPage } from './pages/platform/TenantMembersPage'
import { TenantOnboardingPage } from './pages/platform/TenantOnboardingPage'
import { TenantsListPage } from './pages/platform/TenantsListPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PlatformProvider>
          <TenantProvider>
            <CategoriesProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/accept-invite" element={<AcceptInvitePage />} />

                <Route element={<ProtectedRoute />}>
                  <Route element={<PlatformProtectedRoute />}>
                    <Route element={<PlatformLayout />}>
                      <Route path="/platform" element={<PlatformDashboardPage />} />
                      <Route path="/platform/tenants" element={<TenantsListPage />} />
                      <Route
                        path="/platform/tenants/new"
                        element={<TenantOnboardingPage />}
                      />
                      <Route
                        path="/platform/tenants/:id"
                        element={<TenantDetailPage />}
                      />
                      <Route
                        path="/platform/tenants/:id/members"
                        element={<TenantMembersPage />}
                      />
                      <Route
                        path="/platform/tenants/:id/citizens"
                        element={<TenantCitizensPage />}
                      />
                      <Route path="/platform/audit" element={<AuditLogPage />} />
                      <Route path="/platform/staff" element={<PlatformStaffPage />} />
                      <Route path="/platform/account" element={<AccountPage />} />
                    </Route>
                  </Route>

                  <Route element={<MunicipalProtectedRoute />}>
                    <Route element={<AdminLayout />}>
                      <Route path="/admin" element={<DashboardPage />} />
                      <Route path="/admin/inbox" element={<InboxPage />} />
                      <Route path="/admin/teams" element={<OpsTeamsPage />} />
                      <Route
                        path="/admin/settings/sla"
                        element={<SlaSettingsPage />}
                      />
                      <Route path="/admin/moderation" element={<ModerationPage />} />
                      <Route
                        path="/admin/complaints/:id"
                        element={<ComplaintDetailPage />}
                      />
                      <Route path="/admin/account" element={<AccountPage />} />
                    </Route>
                  </Route>
                </Route>

                <Route path="/" element={<HomeRedirect />} />
                <Route path="*" element={<HomeRedirect />} />
              </Routes>
            </CategoriesProvider>
          </TenantProvider>
        </PlatformProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}
