import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import styles from './AdminLayout.module.css'

export function AdminLayout() {
  const { logout, user } = useAuth()

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
        <Outlet />
      </main>
    </div>
  )
}
