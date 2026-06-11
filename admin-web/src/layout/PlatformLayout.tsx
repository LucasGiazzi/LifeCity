import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { usePlatform } from '../auth/usePlatform'
import { fetchTenants } from '../api/platform/tenants'
import type { TenantListItem } from '../api/platform/tenants'
import styles from './PlatformLayout.module.css'

export function PlatformLayout() {
  const { logout, user } = useAuth()
  const { canOperate, canAdmin, enterTenant, isEntering } = usePlatform()
  const [tenants, setTenants] = useState<TenantListItem[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState('')

  useEffect(() => {
    if (!canOperate) return
    let cancelled = false
    void fetchTenants({ pageSize: 100, status: undefined })
      .then((data) => {
        if (!cancelled) setTenants(data.items)
      })
      .catch(() => {
        if (!cancelled) setTenants([])
      })
    return () => {
      cancelled = true
    }
  }, [canOperate])

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden>
            LC
          </span>
          <span className={styles.brandText}>LifeCity</span>
        </div>
        <p className={styles.badge}>Plataforma</p>
        <nav className={styles.nav} aria-label="Platform">
          <NavLink
            to="/platform"
            end
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Painel
          </NavLink>
          <NavLink
            to="/platform/tenants"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Clientes
          </NavLink>
          <NavLink
            to="/platform/audit"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Auditoria
          </NavLink>
          {canAdmin ? (
            <NavLink
              to="/platform/staff"
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
            >
              Staff
            </NavLink>
          ) : null}
          <NavLink
            to="/platform/account"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            Minha conta
          </NavLink>
        </nav>

        {canOperate ? (
          <>
            <div className={styles.divider} />
            <div className={styles.enterSection}>
              <p className={styles.enterLabel}>Entrar em município</p>
              <select
                className={styles.enterSelect}
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
                aria-label="Selecionar município"
              >
                <option value="">Selecione…</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.displayName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.enterBtn}
                disabled={!selectedTenantId || isEntering}
                onClick={() => {
                  if (selectedTenantId) {
                    void enterTenant(selectedTenantId)
                  }
                }}
              >
                {isEntering ? 'A entrar…' : 'Entrar'}
              </button>
            </div>
          </>
        ) : null}

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
