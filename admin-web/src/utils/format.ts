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
  in_progress: 'Em andamento',
  resolved: 'Resolvida',
  closed: 'Encerrada',
  cancelled: 'Cancelada',
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return 'Pendente'
  return STATUS_LABELS[status] ?? status
}

export function truncateAddress(address: string, max = 72): string {
  if (address.length <= max) return address
  return `${address.slice(0, max).trim()}…`
}
