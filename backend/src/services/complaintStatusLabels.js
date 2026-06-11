const CITIZEN_STATUS_LABELS = {
    pending: 'Registrada',
    triaged: 'Em análise',
    assigned: 'Encaminhada',
    in_progress: 'Em andamento',
    resolved: 'Resolvida',
    closed: 'Encerrada',
    reopened: 'Reaberta',
    cancelled: 'Cancelada',
};

const BASIC_NOTIFY_STATUSES = new Set(['resolved', 'closed', 'cancelled']);

function citizenStatusLabel(status) {
    return CITIZEN_STATUS_LABELS[status] ?? status;
}

function statusChangeDescription(fromStatus, toStatus) {
    const label = citizenStatusLabel(toStatus);
    if (toStatus === 'resolved') {
        return 'Sua ocorrência foi marcada como resolvida.';
    }
    if (toStatus === 'closed') {
        return 'Sua ocorrência foi encerrada pela prefeitura.';
    }
    if (toStatus === 'cancelled') {
        return 'Sua ocorrência foi cancelada.';
    }
    if (toStatus === 'assigned') {
        return 'Sua ocorrência foi encaminhada para uma equipe.';
    }
    if (fromStatus === toStatus) {
        return `Status: ${label}.`;
    }
    return `Sua ocorrência está ${label.toLowerCase()}.`;
}

module.exports = {
    CITIZEN_STATUS_LABELS,
    BASIC_NOTIFY_STATUSES,
    citizenStatusLabel,
    statusChangeDescription,
};
