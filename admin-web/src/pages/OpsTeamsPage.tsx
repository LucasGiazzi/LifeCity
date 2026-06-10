import { useCallback, useEffect, useState } from 'react'
import {
  addOpsTeamMember,
  createOpsTeam,
  fetchOpsTeamMembers,
  fetchOpsTeamsDetailed,
  fetchTenantMembers,
  removeOpsTeamMember,
  updateOpsTeam,
  type OpsTeamDetail,
  type OpsTeamMember,
  type TenantMember,
} from '../api/admin/opsTeams'
import { useCategories } from '../catalog/CategoriesContext'
import styles from './AdminSettingsPage.module.css'

export function OpsTeamsPage() {
  const { categories } = useCategories()
  const [teams, setTeams] = useState<OpsTeamDetail[]>([])
  const [tenantMembers, setTenantMembers] = useState<TenantMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<'create' | 'edit' | 'members' | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<OpsTeamDetail | null>(null)
  const [teamMembers, setTeamMembers] = useState<OpsTeamMember[]>([])
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategories, setFormCategories] = useState<string[]>([])
  const [formActive, setFormActive] = useState(true)
  const [addUserId, setAddUserId] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [teamsData, membersData] = await Promise.all([
        fetchOpsTeamsDetailed(),
        fetchTenantMembers(),
      ])
      setTeams(teamsData)
      setTenantMembers(membersData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar equipes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setFormName('')
    setFormDescription('')
    setFormCategories([])
    setFormActive(true)
    setSelectedTeam(null)
    setModal('create')
  }

  const openEdit = (team: OpsTeamDetail) => {
    setSelectedTeam(team)
    setFormName(team.name)
    setFormDescription(team.description ?? '')
    setFormCategories(team.defaultCategoryIds)
    setFormActive(team.isActive)
    setModal('edit')
  }

  const openMembers = async (team: OpsTeamDetail) => {
    setSelectedTeam(team)
    setAddUserId('')
    setModal('members')
    try {
      const members = await fetchOpsTeamMembers(team.id)
      setTeamMembers(members)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar membros.')
    }
  }

  const closeModal = () => {
    setModal(null)
    setSelectedTeam(null)
  }

  const toggleCategory = (categoryId: string) => {
    setFormCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const handleSaveTeam = async () => {
    if (!formName.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (modal === 'create') {
        await createOpsTeam({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          defaultCategoryIds: formCategories,
        })
      } else if (selectedTeam) {
        await updateOpsTeam(selectedTeam.id, {
          name: formName.trim(),
          description: formDescription.trim() || null,
          defaultCategoryIds: formCategories,
          isActive: formActive,
        })
      }
      closeModal()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar equipe.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddMember = async () => {
    if (!selectedTeam || !addUserId) return
    setSaving(true)
    try {
      await addOpsTeamMember(selectedTeam.id, { userId: addUserId })
      setTeamMembers(await fetchOpsTeamMembers(selectedTeam.id))
      setAddUserId('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao adicionar membro.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!selectedTeam) return
    setSaving(true)
    try {
      await removeOpsTeamMember(selectedTeam.id, userId)
      setTeamMembers(await fetchOpsTeamMembers(selectedTeam.id))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao remover membro.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Equipes operacionais</h1>
          <p className={styles.subtitle}>
            Gestão de equipes municipais e roteamento automático
          </p>
        </div>
        <button type="button" className={styles.btnPrimary} onClick={openCreate}>
          Nova equipe
        </button>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.card}>
        {loading ? (
          <p className={styles.muted}>A carregar…</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Membros</th>
                <th>Categorias</th>
                <th>Estado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id}>
                  <td>
                    <strong>{team.name}</strong>
                    {team.description ? (
                      <div className={styles.muted}>{team.description}</div>
                    ) : null}
                  </td>
                  <td>{team.memberCount}</td>
                  <td>{team.defaultCategoryIds.length}</td>
                  <td>
                    {team.isActive ? (
                      'Ativa'
                    ) : (
                      <span className={styles.badgeInactive}>Inativa</span>
                    )}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => void openMembers(team)}
                      >
                        Membros
                      </button>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => openEdit(team)}
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal === 'create' || modal === 'edit' ? (
        <div className={styles.modalBackdrop} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>
              {modal === 'create' ? 'Nova equipe' : 'Editar equipe'}
            </h2>
            <label className={styles.field}>
              <span className={styles.label}>Nome</span>
              <input
                className={styles.input}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Descrição</span>
              <textarea
                className={styles.textarea}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </label>
            <div className={styles.field}>
              <span className={styles.label}>Categorias padrão (roteamento)</span>
              <div className={styles.actions}>
                {categories.map((cat) => (
                  <label key={cat.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={formCategories.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                    />
                    {cat.name}
                  </label>
                ))}
              </div>
            </div>
            {modal === 'edit' ? (
              <label className={styles.field}>
                <span className={styles.label}>
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                  />{' '}
                  Equipe ativa
                </span>
              </label>
            ) : null}
            <div className={styles.actions}>
              <button type="button" className={styles.btn} onClick={closeModal}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={saving}
                onClick={() => void handleSaveTeam()}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'members' && selectedTeam ? (
        <div className={styles.modalBackdrop} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Membros — {selectedTeam.name}</h2>
            <ul>
              {teamMembers.map((m) => (
                <li key={m.userId} style={{ marginBottom: 8 }}>
                  {m.name} ({m.email}) — {m.role}
                  <button
                    type="button"
                    className={styles.btnDanger}
                    style={{ marginLeft: 8 }}
                    disabled={saving}
                    onClick={() => void handleRemoveMember(m.userId)}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
            <div className={styles.field}>
              <span className={styles.label}>Adicionar membro</span>
              <select
                className={styles.select}
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
              >
                <option value="">Selecionar…</option>
                {tenantMembers
                  .filter((tm) => !teamMembers.some((m) => m.userId === tm.userId))
                  .map((tm) => (
                    <option key={tm.userId} value={tm.userId}>
                      {tm.name} ({tm.email})
                    </option>
                  ))}
              </select>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.btn} onClick={closeModal}>
                Fechar
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={saving || !addUserId}
                onClick={() => void handleAddMember()}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
