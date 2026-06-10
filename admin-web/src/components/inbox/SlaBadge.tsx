import { slaColor, slaLabel, type SlaState } from '../../utils/format'
import styles from './SlaBadge.module.css'

type SlaBadgeProps = {
  state: SlaState | string | null | undefined
  dueAt?: string | null
}

export function SlaBadge({ state, dueAt }: SlaBadgeProps) {
  const key = (state ?? 'ok') as SlaState
  const color = slaColor(key)
  const label = slaLabel(key)

  return (
    <span
      className={styles.badge}
      style={{
        color,
        background: `${color}18`,
        borderColor: `${color}40`,
      }}
      title={dueAt ? `Prazo: ${new Date(dueAt).toLocaleString('pt-BR')}` : undefined}
    >
      {label}
    </span>
  )
}
