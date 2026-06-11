import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { usePlatform } from '../../auth/usePlatform'
import {
  fetchTenantMembers,
  inviteTenantMember,
  patchTenantMember,
  type PendingInvitation,
  type TenantMember,
} from '../../api/platform/members'
import type { InvitationResult } from '../../api/platform/tenants'
import { CopySetupLink } from '../../components/platform/CopySetupLink'
import { TenantTabs } from '../../components/platform/TenantTabs'
import { formatDateTime, tenantMemberRoleLabel } from '../../utils/format'
import styles from './platformPage.module.css'

const ROLES = ['owner', 'admin', 'operator', 'viewer'] as const

export function TenantMembersPage() {
  const { id } = useParams<{ id: string }>()
  const { canOperate } = usePlatform()
  const [members, setMembers] = useState<TenantMember[]>([])
  const [pending, setPending] = useState<PendingInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('admin')
  const [inviting, setInviting] = useState(false)
  const [lastInvitation, setLastInvitation] = useState<InvitationResult | null>(
    null
  )
  const [memberAddedMsg, setMemberAddedMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTenantMembers(id)
      setMembers(data.members)
      setPending(data.pendingInvitations)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar membros.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function handleInvite() {
    if (!id || !inviteEmail.trim()) return
    setInviting(true)
    setError(null)
    setLastInvitation(null)
    setMemberAddedMsg(null)
    try {
      const result = await inviteTenantMember(id, {
        email: inviteEmail.trim(),
        role: inviteRole,
        name: inviteName.trim() || undefined,
      })
      if ('invitation' in result) {
        setLastInvitation(result.invitation)
      } else {
        setMemberAddedMsg(result.message)
      }
      setInviteEmail('')
      setInviteName('')
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao convidar.')
    } finally {
      setInviting(false)
    }
  }

  async function handleDeactivate(userId: string) {
    if (!id || !window.confirm('Desativar este membro?')) return
    try {
      await patchTenantMember(id, userId, { isActive: false })
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao desativar.')
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Membros municipais</h1>
          <p className={styles.subtitle}>Gestores e operadores da prefeitura</p>
        </div>
        <div className={styles.actions}>
          {canOperate ? (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setShowInvite(true)}
            >
              Convidar
            </button>
          ) : null}
          <Link to={`/platform/tenants/${id}`} className={styles.btn}>
            Voltar ao resumo
          </Link>
        </div>
      </header>

      {id ? <TenantTabs tenantId={id} /> : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {memberAddedMsg ? (
        <div className={styles.card}>
          <p>{memberAddedMsg}</p>
        </div>
      ) : null}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Membros ativos</h2>
        {loading ? (
          <p className={styles.muted}>A carregar…</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Desde</th>
                {canOperate ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId}>
                  <td>{m.name}</td>
                  <td>{m.email}</td>
                  <td>{tenantMemberRoleLabel(m.role)}</td>
                  <td>{formatDateTime(m.joinedAt)}</td>
                  {canOperate && m.isActive ? (
                    <td>
                      <button
                        type="button"
                        className={`${styles.btnDanger} ${styles.btnSm}`}
                        onClick={() => void handleDeactivate(m.userId)}
                      >
                        Desativar
                      </button>
                    </td>
                  ) : canOperate ? (
                    <td />
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Convites pendentes</h2>
        {pending.length === 0 ? (
          <p className={styles.muted}>Nenhum convite pendente.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Expira</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.id}>
                  <td>{p.email}</td>
                  <td>{tenantMemberRoleLabel(p.role)}</td>
                  <td>{formatDateTime(p.expiresAt)}</td>
                  <td>
                    {p.setupLink ? (
                      <CopySetupLink setupLink={p.setupLink} compact />
                    ) : (
                      <span className={styles.muted}>
                        Reenvie convite para novo link
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showInvite ? (
        <div
          className={styles.modalBackdrop}
          onClick={() => setShowInvite(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowInvite(false)}
          role="presentation"
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="invite-title"
          >
            <h2 id="invite-title" className={styles.modalTitle}>
              Convidar membro
            </h2>
            <label className={styles.field}>
              <span className={styles.label}>E-mail</span>
              <input
                className={styles.input}
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Nome</span>
              <input
                className={styles.input}
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Papel</span>
              <select
                className={styles.select}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {tenantMemberRoleLabel(r)}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => setShowInvite(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={inviting}
                onClick={() => void handleInvite()}
              >
                {inviting ? 'A enviar…' : 'Enviar convite'}
              </button>
            </div>
            {lastInvitation ? (
              <CopySetupLink
                setupLink={lastInvitation.setupLink}
                emailSent={lastInvitation.emailSent}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
