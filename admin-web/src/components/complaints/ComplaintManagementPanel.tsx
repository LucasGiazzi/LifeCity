import { useCallback, useEffect, useState } from 'react'
import type { ComplaintDetail } from '../../api/admin/complaints'
import {
  fetchComplaintEvents,
  fetchOpsTeams,
  patchComplaintAssignment,
  patchComplaintStatus,
  postComplaintNote,
  type ComplaintEvent,
  type OpsTeam,
} from '../../api/admin/complaintOperations'
import { ADMIN_STATUS_OPTIONS, slaLabel, statusLabel } from '../../utils/format'
import { SlaBadge } from '../inbox/SlaBadge'
import { ComplaintTimeline } from './ComplaintTimeline'
import styles from './ComplaintManagementPanel.module.css'

type ComplaintManagementPanelProps = {
  complaint: ComplaintDetail
  canEdit: boolean
  onUpdated: (complaint: ComplaintDetail) => void
}

export function ComplaintManagementPanel({
  complaint,
  canEdit,
  onUpdated,
}: ComplaintManagementPanelProps) {
  const [teams, setTeams] = useState<OpsTeam[]>([])
  const [events, setEvents] = useState<ComplaintEvent[]>([])
  const [status, setStatus] = useState(complaint.status)
  const [priority, setPriority] = useState(complaint.priority ?? 3)
  const [opsTeamId, setOpsTeamId] = useState(complaint.assigned_ops_team_id ?? '')
  const [noteText, setNoteText] = useState('')
  const [noteInternal, setNoteInternal] = useState(true)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [saving, setSaving] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true)
    try {
      const list = await fetchComplaintEvents(complaint.id, canEdit)
      setEvents(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar timeline.')
    } finally {
      setLoadingEvents(false)
    }
  }, [complaint.id, canEdit])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  useEffect(() => {
    void fetchOpsTeams()
      .then(setTeams)
      .catch(() => setTeams([]))
  }, [])

  useEffect(() => {
    setStatus(complaint.status)
    setPriority(complaint.priority ?? 3)
    setOpsTeamId(complaint.assigned_ops_team_id ?? '')
  }, [complaint])

  async function handleSave() {
    if (!canEdit) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      let latest = complaint

      if (status !== complaint.status) {
        const result = await patchComplaintStatus(complaint.id, {
          status,
          // isInternal controla apenas visibilidade na timeline admin/cidadã;
          // notificações push/in-app seguem watchers (ADR-004 D-004).
          isInternal: false,
        })
        latest = { ...latest, ...result.complaint }
      }

      const teamChanged = opsTeamId !== (complaint.assigned_ops_team_id ?? '')
      const priorityChanged = priority !== (complaint.priority ?? 3)

      if (teamChanged || priorityChanged) {
        const result = await patchComplaintAssignment(complaint.id, {
          ...(teamChanged ? { opsTeamId: opsTeamId || null } : {}),
          ...(priorityChanged ? { priority } : {}),
          isInternal: true,
        })
        latest = { ...latest, ...result.complaint }
      }

      onUpdated(latest)
      setSuccess('Alterações guardadas.')
      await loadEvents()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar alterações.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddNote() {
    if (!canEdit || !noteText.trim()) return
    setNoteSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await postComplaintNote(complaint.id, {
        text: noteText.trim(),
        isInternal: noteInternal,
      })
      setNoteText('')
      setSuccess('Nota registada.')
      await loadEvents()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao registar nota.')
    } finally {
      setNoteSaving(false)
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.slaRow}>
        <SlaBadge state={complaint.sla_state} dueAt={complaint.sla_due_at} />
        {complaint.sla_due_at ? (
          <span className={styles.slaHint}>
            Prazo: {new Date(complaint.sla_due_at).toLocaleString('pt-BR')} (
            {slaLabel(complaint.sla_state)})
          </span>
        ) : null}
      </div>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span className={styles.label}>Status</span>
          <select
            className={styles.select}
            value={status}
            disabled={!canEdit || saving}
            onChange={(e) => setStatus(e.target.value)}
          >
            {ADMIN_STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {statusLabel(opt)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Prioridade</span>
          <select
            className={styles.select}
            value={priority}
            disabled={!canEdit || saving}
            onChange={(e) => setPriority(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? '(urgente)' : n === 5 ? '(baixa)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.label}>Equipe operacional</span>
          <select
            className={styles.select}
            value={opsTeamId}
            disabled={!canEdit || saving}
            onChange={(e) => setOpsTeamId(e.target.value)}
          >
            <option value="">Sem equipe</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {canEdit ? (
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? 'A guardar…' : 'Salvar alterações'}
        </button>
      ) : (
        <p className={styles.readOnlyHint}>Modo visualização — sem permissão para editar.</p>
      )}

      <hr className={styles.divider} />

      <div className={styles.noteSection}>
        <label className={styles.field}>
          <span className={styles.label}>Nota</span>
          <textarea
            className={styles.textarea}
            rows={3}
            value={noteText}
            disabled={!canEdit || noteSaving}
            placeholder="Registar observação sobre esta ocorrência…"
            onChange={(e) => setNoteText(e.target.value)}
          />
        </label>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={noteInternal}
            disabled={!canEdit || noteSaving}
            onChange={(e) => setNoteInternal(e.target.checked)}
          />
          Nota interna (não notifica cidadão)
        </label>
        {canEdit ? (
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={noteSaving || !noteText.trim()}
            onClick={() => void handleAddNote()}
          >
            {noteSaving ? 'A registar…' : 'Registar nota'}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {success ? <p className={styles.success}>{success}</p> : null}

      <hr className={styles.divider} />

      <h3 className={styles.timelineTitle}>Timeline</h3>
      <ComplaintTimeline
        events={events}
        loading={loadingEvents}
        showInternal={canEdit}
      />
    </div>
  )
}
