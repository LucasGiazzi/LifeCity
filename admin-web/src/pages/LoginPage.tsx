import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, canAccessAdmin, accessToken, platformRole, isLoading } =
    useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (accessToken && canAccessAdmin) {
    return (
      <Navigate to={platformRole ? '/platform' : '/admin'} replace />
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const dest = await login(email, password)
      navigate(dest === 'platform' ? '/platform' : '/admin', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar sessão.')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.gradientBg} aria-hidden />
      <div className={styles.column}>
        <header className={styles.header}>
          <div className={styles.iconChip} aria-hidden>
            <svg
              className={styles.cityIcon}
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v0M9 12v0M9 15v0M9 18v0M15 15v0M15 18v0"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className={styles.title}>Bem-vindo de volta!</h1>
          <p className={styles.subtitle}>Entre na sua conta para continuar.</p>
        </header>

        <div className={styles.sheet}>
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span className={styles.visuallyHidden}>E-mail</span>
              <span className={styles.inputWrap}>
                <span className={styles.inputIcon} aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 6h16v12H4V6zm0 0l8 6 8-6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="E-mail"
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </span>
            </label>

            <label className={styles.field}>
              <span className={styles.visuallyHidden}>Senha</span>
              <span className={styles.inputWrap}>
                <span className={styles.inputIcon} aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M7 11V8a5 5 0 0110 0v3M6 11h12v10H6V11z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Senha"
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className={styles.togglePw}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword ? 'Ocultar senha' : 'Mostrar senha'
                  }
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A7.4 7.4 0 0112 5c5 0 9 5 9 5s-1.4 2.1-3.7 3.8M6.4 6.4C4 8.2 3 12 3 12s4 7 9 7c1.1 0 2.1-.2 3-.6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M12 19c-5 0-9-7-9-7 1.3-2 3.2-3.7 5.4-4.9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                  )}
                </button>
              </span>
            </label>

            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className={styles.submit}
              disabled={isLoading}
            >
              {isLoading ? 'A entrar…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
