import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useTenant } from '../auth/useTenant'
import { fetchModerationPendingCount } from '../api/admin/moderation'
import { ImpersonationBanner } from '../components/platform/ImpersonationBanner'
import styles from './AdminLayout.module.css'

function isAdminRole(role: string | undefined) {
  return role === 'admin' || role === 'owner'
}

export function AdminLayout() {
  const { logout, user } = useAuth()
  const { activeTenant } = useTenant()
  const [pendingReports, setPendingReports] = useState(0)

  useEffect(() => {
    if (!isAdminRole(activeTenant?.role)) {
      setPendingReports(0)
      return
    }

    let cancelled = false
    void fetchModerationPendingCount()
      .then((count) => {
        if (!cancelled) setPendingReports(count)
      })
      .catch(() => {
        if (!cancelled) setPendingReports(0)
      })

    return () => {
      cancelled = true
    }
  }, [activeTenant?.role, activeTenant?.id])

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden>
            LC
          </span>
          <span className={styles.brandText}>LifeCity</span>
        </div>
        <p className={styles.badge}>Painel admin</p>
        <nav className={styles.nav} aria-label="Principal">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/admin/inbox"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Inbox
          </NavLink>
          {isAdminRole(activeTenant?.role) ? (
            <>
              <NavLink
                to="/admin/teams"
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                }
              >
                Equipes
              </NavLink>
              <NavLink
                to="/admin/settings/sla"
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                }
              >
                SLA
              </NavLink>
              <NavLink
                to="/admin/moderation"
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                }
              >
                Moderação
                {pendingReports > 0 ? (
                  <span className={styles.navBadge}>{pendingReports}</span>
                ) : null}
              </NavLink>
            </>
          ) : null}
          <NavLink
            to="/admin/account"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Minha conta
          </NavLink>
        </nav>
        <div className={styles.sidebarFooter}>
          {user ? (
            <p className={styles.userHint}>
              {user.name}
              <br />
              <span className={styles.userEmail}>{user.email}</span>
            </p>
          ) : null}
          <button type="button" className={styles.logout} onClick={logout}>
            Sair
          </button>
        </div>
      </aside>
      <main className={styles.main}>
        <ImpersonationBanner />
        <Outlet />
      </main>
    </div>
  )
}
