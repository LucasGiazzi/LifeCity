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

export function formatBrl(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

export function formatPopulation(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('pt-BR')
}

const TENANT_STATUS_LABELS: Record<string, string> = {
  trial: 'Trial',
  active: 'Ativo',
  suspended: 'Suspenso',
}

export function tenantStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return TENANT_STATUS_LABELS[status] ?? status
}

const HEALTH_STATUS_LABELS: Record<string, string> = {
  healthy: 'Saudável',
  degraded: 'Com pendências',
  critical: 'Crítico',
}

export function healthStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return HEALTH_STATUS_LABELS[status] ?? status
}

const HEALTH_CHECK_LABELS: Record<string, string> = {
  tenant_active: 'Cliente ativo',
  malhas_bairros: 'Malha de bairros',
  malhas_setores: 'Malha de setores',
  ops_teams: 'Equipes operacionais',
  sla_policies: 'Políticas de SLA',
  owner_assigned: 'Gestor municipal',
  geo_config: 'Área geográfica',
}

export function healthCheckLabel(key: string): string {
  return HEALTH_CHECK_LABELS[key] ?? key
}

export function healthCheckDetail(key: string, detail: string): string {
  if (key === 'tenant_active' && detail.startsWith('status=')) {
    const status = detail.replace('status=', '')
    return `Status: ${tenantStatusLabel(status)}`
  }
  if (key === 'geo_config') {
    if (detail.includes('malha IBGE') || detail.includes('malhas_municipios')) {
      return detail
    }
    if (detail.includes('configurado')) {
      return 'Limites definidos a partir da malha municipal'
    }
    return 'Área geográfica não configurada'
  }
  return detail
}

const PLATFORM_ROLE_LABELS: Record<string, string> = {
  viewer: 'Visualizador',
  operator: 'Operador',
  admin: 'Administrador',
}

export function platformRoleLabel(role: string | null | undefined): string {
  if (!role) return '—'
  return PLATFORM_ROLE_LABELS[role] ?? role
}

const TENANT_MEMBER_ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Visualizador',
}

export function tenantMemberRoleLabel(role: string | null | undefined): string {
  if (!role) return '—'
  return TENANT_MEMBER_ROLE_LABELS[role] ?? role
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'tenant.create': 'Cliente criado',
  'tenant.update': 'Cliente atualizado',
  'tenant.suspend': 'Cliente suspenso',
  'tenant.activate': 'Cliente ativado',
  'member.invite': 'Convite enviado',
  'member.invite_accept': 'Convite aceite',
  'member.role_change': 'Papel alterado',
  'member.deactivate': 'Membro desativado',
  'impersonation.start': 'Entrada em suporte',
  'impersonation.end': 'Saída de suporte',
}

export function auditActionLabel(action: string | null | undefined): string {
  if (!action) return '—'
  return AUDIT_ACTION_LABELS[action] ?? action
}

const POPULATION_SOURCE_LABELS: Record<string, string> = {
  utb_demografia: 'UTB / demografia',
  manual: 'Informada manualmente',
  unknown: 'Desconhecida',
}

export function populationSourceLabel(source: string | null | undefined): string {
  if (!source) return '—'
  return POPULATION_SOURCE_LABELS[source] ?? source
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(value)}%`
}

export function formatDurationDays(days: number | null | undefined): string {
  if (days == null || !Number.isFinite(days)) return '—'
  if (days < 1) {
    const hours = Math.round(days * 24)
    return hours <= 1 ? '1 hora' : `${hours} horas`
  }
  const rounded = Math.round(days * 10) / 10
  return `${rounded.toLocaleString('pt-BR')} dias`
}
