import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { getMeRequest } from '../api/auth'
import type { AdminUser } from '../api/auth'
import styles from './AccountPage.module.css'

export function AccountPage() {
  const { setUserFromMe, logout } = useAuth()
  const [profile, setProfile] = useState<AdminUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const me = await getMeRequest()
        if (cancelled) return
        setProfile(me)
        setUserFromMe(me)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro ao carregar perfil.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [logout, setUserFromMe])

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Minha conta</h1>

      {loading ? (
        <p className={styles.muted}>A carregar…</p>
      ) : error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : profile ? (
        <div className={styles.card}>
          <div className={styles.avatarRow}>
            {profile.photo_url ? (
              <img
                src={profile.photo_url}
                alt=""
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarPlaceholder} aria-hidden>
                {profile.name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
            )}
            <div>
              <p className={styles.name}>{profile.name}</p>
              <p className={styles.email}>{profile.email}</p>
            </div>
          </div>

          <dl className={styles.dl}>
            <div className={styles.row}>
              <dt>Telefone</dt>
              <dd>{profile.phone ?? '—'}</dd>
            </div>
            <div className={styles.row}>
              <dt>Nível de acesso</dt>
              <dd>
                <span className={styles.levelBadge}>{profile.user_level}</span>
              </dd>
            </div>
            {profile.birth_date ? (
              <div className={styles.row}>
                <dt>Data de nascimento</dt>
                <dd>{profile.birth_date}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </div>
  )
}
