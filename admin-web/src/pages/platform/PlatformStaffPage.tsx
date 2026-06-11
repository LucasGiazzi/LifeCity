import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { PlatformRole } from '../../api/auth'
import { usePlatform } from '../../auth/usePlatform'
import {
  createPlatformStaff,
  fetchPlatformStaff,
  patchPlatformStaff,
  type PlatformStaffMember,
} from '../../api/platform/staff'
import { formatDateTime, platformRoleLabel } from '../../utils/format'
import styles from './platformPage.module.css'

const ROLES: PlatformRole[] = ['viewer', 'operator', 'admin']

export function PlatformStaffPage() {
  const { canAdmin } = usePlatform()
  const [staff, setStaff] = useState<PlatformStaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<PlatformRole>('operator')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPlatformStaff()
      setStaff(data.staff)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar staff.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canAdmin) void load()
  }, [canAdmin, load])

  if (!canAdmin) {
    return <Navigate to="/platform" replace />
  }

  async function handleAdd() {
    if (!email.trim()) return
    setSaving(true)
    setError(null)
    try {
      await createPlatformStaff({ email: email.trim(), role })
      setEmail('')
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao adicionar staff.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(member: PlatformStaffMember) {
    try {
      await patchPlatformStaff(member.userId, { isActive: !member.isActive })
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar.')
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Staff LifeCity</h1>
          <p className={styles.subtitle}>Utilizadores com acesso à plataforma</p>
        </div>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Adicionar staff</h2>
        <div className={styles.filters}>
          <input
            className={styles.input}
            type="email"
            placeholder="E-mail (conta já existente)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            className={styles.select}
            value={role}
            onChange={(e) => setRole(e.target.value as PlatformRole)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {platformRoleLabel(r)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={saving}
            onClick={() => void handleAdd()}
          >
            {saving ? 'A adicionar…' : 'Adicionar'}
          </button>
        </div>
      </div>

      <div className={styles.card}>
        {loading ? (
          <p className={styles.muted}>A carregar…</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Ativo</th>
                <th>Desde</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {staff.map((m) => (
                <tr key={m.userId}>
                  <td>{m.name}</td>
                  <td>{m.email}</td>
                  <td>{platformRoleLabel(m.role)}</td>
                  <td>{m.isActive ? 'Sim' : 'Não'}</td>
                  <td>{formatDateTime(m.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.btn}
                      onClick={() => void handleToggleActive(m)}
                    >
                      {m.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
