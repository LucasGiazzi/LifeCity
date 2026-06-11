import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  acceptInviteRequest,
  fetchInviteInfo,
  type InviteInfo,
} from '../api/auth'
import { useAuth } from '../auth/useAuth'
import { formatDateTime } from '../utils/format'
import styles from './LoginPage.module.css'

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { applySession } = useAuth()
  const token = searchParams.get('token') ?? ''

  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Link inválido — token em falta.')
      setLoading(false)
      return
    }
    let cancelled = false
    void fetchInviteInfo(token)
      .then((data) => {
        if (!cancelled) {
          setInfo(data)
          setName(data.name ?? '')
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Convite inválido ou expirado.'
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    setSubmitting(true)
    try {
      const data = await acceptInviteRequest({
        token,
        password,
        name: name.trim() || undefined,
      })
      applySession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          phone: data.user.phone ?? null,
          photo_url: data.user.photo_url ?? null,
          birth_date: data.user.birth_date ?? null,
          user_level: data.user.user_level,
        },
        tenants: data.tenants,
        activeTenantId: data.activeTenantId ?? null,
        platformRole: null,
      })
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao definir senha.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div className={styles.page}>
        <div className={styles.column}>
          <p className={styles.error} role="alert">
            {error}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.gradientBg} aria-hidden />
      <div className={styles.column}>
        <header className={styles.header}>
          <h1 className={styles.title}>Definir senha</h1>
          <p className={styles.subtitle}>
            {info
              ? `Convite para ${info.tenantDisplayName}`
              : 'A validar convite…'}
          </p>
        </header>

        <div className={styles.sheet}>
          {loading ? (
            <p>A carregar…</p>
          ) : error && !info ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : info ? (
            <form className={styles.form} onSubmit={handleSubmit}>
              <p style={{ fontSize: 14, margin: '0 0 16px' }}>
                Conta: <strong>{info.email}</strong>
                <br />
                Expira: {formatDateTime(info.expiresAt)}
              </p>

              <label className={styles.field}>
                <span className={styles.visuallyHidden}>Nome</span>
                <input
                  className={styles.input}
                  placeholder="Nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.visuallyHidden}>Nova senha</span>
                <input
                  type="password"
                  className={styles.input}
                  placeholder="Nova senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.visuallyHidden}>Confirmar senha</span>
                <input
                  type="password"
                  className={styles.input}
                  placeholder="Confirmar senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </label>

              {error ? (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className={styles.submit}
                disabled={submitting}
              >
                {submitting ? 'A guardar…' : 'Ativar conta'}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  )
}
