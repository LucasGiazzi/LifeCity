export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('pt-BR')
  } catch {
    return value
  }
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  triaged: 'Em análise',
  assigned: 'Atribuída',
  in_progress: 'Em andamento',
  resolved: 'Resolvida',
  closed: 'Encerrada',
  cancelled: 'Cancelada',
  reopened: 'Reaberta',
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#78909C',
  triaged: '#6366F1',
  assigned: '#7C3AED',
  in_progress: '#2563EB',
  resolved: '#059669',
  closed: '#475569',
  cancelled: '#DC2626',
  reopened: '#D97706',
}

export const ADMIN_STATUS_OPTIONS = [
  'pending',
  'triaged',
  'assigned',
  'in_progress',
  'resolved',
  'closed',
  'reopened',
  'cancelled',
] as const

export type SlaState = 'ok' | 'at_risk' | 'breached'

const SLA_LABELS: Record<SlaState, string> = {
  ok: 'OK',
  at_risk: 'Em risco',
  breached: 'Estourado',
}

const SLA_COLORS: Record<SlaState, string> = {
  ok: '#059669',
  at_risk: '#D97706',
  breached: '#DC2626',
}

export function slaLabel(state: SlaState | string | null | undefined): string {
  if (!state || !(state in SLA_LABELS)) return '—'
  return SLA_LABELS[state as SlaState]
}

export function slaColor(state: SlaState | string | null | undefined): string {
  if (!state || !(state in SLA_COLORS)) return SLA_COLORS.ok
  return SLA_COLORS[state as SlaState]
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return 'Pendente'
  return STATUS_LABELS[status] ?? status
}

export function statusColor(status: string | null | undefined): string {
  const key = status?.trim() || 'pending'
  return STATUS_COLORS[key] ?? STATUS_COLORS.pending
}

export function truncateAddress(address: string, max = 72): string {
  if (address.length <= max) return address
  return `${address.slice(0, max).trim()}…`
}
