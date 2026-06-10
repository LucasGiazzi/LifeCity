const TERMINAL_STATUSES = new Set(['resolved', 'closed', 'cancelled']);

function computeSlaState(slaDueAt, status) {
    if (!slaDueAt || TERMINAL_STATUSES.has(status)) {
        return 'ok';
    }

    const due = new Date(slaDueAt);
    const now = Date.now();
    const dueMs = due.getTime();

    if (dueMs < now) {
        return 'breached';
    }

    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    if (dueMs < now + twentyFourHoursMs) {
        return 'at_risk';
    }

    return 'ok';
}

async function getPolicy(pool, tenantId, categoryId) {
    if (!categoryId) {
        return null;
    }

    const { rows } = await pool.query(
        `SELECT response_hours, resolution_hours, business_hours_only
         FROM public.tenant_sla_policies
         WHERE tenant_id = $1::uuid
           AND category_id = $2::uuid
           AND is_active = true
         LIMIT 1`,
        [tenantId, categoryId]
    );

    return rows[0] ?? null;
}

async function computeSlaDueAt(pool, tenantId, categoryId, baseTimestamp) {
    const policy = await getPolicy(pool, tenantId, categoryId);
    if (!policy) {
        return null;
    }

    const { rows } = await pool.query(
        `SELECT ($1::timestamptz + ($2::text || ' hours')::interval) AS sla_due_at`,
        [baseTimestamp, String(policy.resolution_hours)]
    );

    return rows[0]?.sla_due_at ?? null;
}

function slaFilterClause(slaParam, paramIndex) {
    if (!slaParam) {
        return { clause: null, value: null };
    }

    const terminal = "('resolved', 'closed', 'cancelled')";

    switch (slaParam) {
        case 'breached':
            return {
                clause: `(c.sla_due_at IS NOT NULL
                    AND c.sla_due_at < NOW()
                    AND COALESCE(c.status, 'pending') NOT IN ${terminal})`,
            };
        case 'at_risk':
            return {
                clause: `(c.sla_due_at IS NOT NULL
                    AND c.sla_due_at >= NOW()
                    AND c.sla_due_at < NOW() + INTERVAL '24 hours'
                    AND COALESCE(c.status, 'pending') NOT IN ${terminal})`,
            };
        case 'ok':
            return {
                clause: `(c.sla_due_at IS NULL
                    OR c.sla_due_at >= NOW() + INTERVAL '24 hours'
                    OR COALESCE(c.status, 'pending') IN ${terminal})`,
            };
        default:
            return { clause: null, value: null, nextIndex: paramIndex };
    }
}

module.exports = {
    computeSlaState,
    getPolicy,
    computeSlaDueAt,
    slaFilterClause,
    TERMINAL_STATUSES,
};
