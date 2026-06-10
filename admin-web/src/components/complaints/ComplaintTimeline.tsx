import type { ComplaintEvent } from '../../api/admin/complaintOperations'
import { formatDateTime, statusLabel } from '../../utils/format'
import styles from './ComplaintTimeline.module.css'

type ComplaintTimelineProps = {
  events: ComplaintEvent[]
  loading: boolean
  showInternal: boolean
}

function describeEvent(event: ComplaintEvent): string {
  const p = event.payload
  switch (event.event_type) {
    case 'status_change':
      return `Status: ${statusLabel(String(p.from ?? ''))} → ${statusLabel(String(p.to ?? ''))}${p.note ? ` — ${String(p.note)}` : ''}`
    case 'assignment':
      if (p.statusFrom && p.statusTo) {
        return `Atribuição (${statusLabel(String(p.statusFrom))} → ${statusLabel(String(p.statusTo))})${p.note ? ` — ${String(p.note)}` : ''}`
      }
      return `Atribuição atualizada${p.note ? `: ${String(p.note)}` : ''}`
    case 'note':
      return String(p.text ?? 'Nota registada')
    case 'priority_change':
      return `Prioridade alterada para ${String(p.priority ?? '—')}`
    case 'moderation':
      return `Moderação: ${String(p.action ?? 'ação')}`
    default:
      return event.event_type
  }
}

export function ComplaintTimeline({
  events,
  loading,
  showInternal,
}: ComplaintTimelineProps) {
  const visible = showInternal
    ? events
    : events.filter((e) => !e.is_internal)

  if (loading) {
    return <p className={styles.muted}>A carregar timeline…</p>
  }

  if (visible.length === 0) {
    return <p className={styles.muted}>Sem registos na timeline.</p>
  }

  return (
    <ul className={styles.list}>
      {visible.map((event) => (
        <li key={event.id} className={styles.item}>
          <span className={styles.dot} aria-hidden />
          <div className={styles.body}>
            <p className={styles.meta}>
              {formatDateTime(event.created_at)}
              {event.actor_name ? ` · ${event.actor_name}` : ''}
              {event.is_internal ? (
                <span className={styles.internalTag}>Interna</span>
              ) : null}
            </p>
            <p className={styles.text}>{describeEvent(event)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
