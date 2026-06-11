const { TENANT_COMPLAINT_FILTER } = require('./tenantService');
const { computeSlaDueAt, computeSlaState, TERMINAL_STATUSES } = require('./slaService');
const { resolveAutoOpsTeam } = require('./opsRoutingService');
const watchService = require('./complaintWatchService');
const pushService = require('./pushNotificationService');
const supabasePool = require('../infra/supabasePool');

const ALLOWED_TRANSITIONS = {
    pending: ['triaged', 'assigned', 'in_progress', 'cancelled'],
    triaged: ['assigned', 'in_progress', 'cancelled'],
    assigned: ['in_progress', 'cancelled', 'triaged'],
    in_progress: ['resolved', 'cancelled', 'assigned'],
    resolved: ['closed', 'reopened'],
    closed: ['reopened'],
    reopened: ['triaged', 'assigned', 'in_progress', 'cancelled'],
    cancelled: [],
};

const MUNICIPAL_LOCK_STATUSES = new Set(['assigned', 'in_progress', 'closed', 'cancelled']);

async function getComplaintForTenant(pool, complaintId, tenantId, cdMun) {
    const { rows } = await pool.query(
        `SELECT
            c.id,
            c.status,
            c.created_by,
            c.category_id,
            c.cd_bairro,
            c.created_at,
            c.tenant_id,
            c.assigned_ops_team_id,
            c.assigned_user_id,
            c.assigned_at,
            c.priority,
            c.sla_due_at,
            c.resolved_at,
            c.closed_at
         FROM public.complaints c
         WHERE c.id = $3::bigint AND ${TENANT_COMPLAINT_FILTER.trim()}`,
        [tenantId, cdMun, complaintId]
    );

    return rows[0] ?? null;
}

function isUnderMunicipalManagement(complaint) {
    if (!complaint) {
        return false;
    }

    if (complaint.assigned_ops_team_id) {
        return true;
    }

    const status = complaint.status || 'pending';
    return MUNICIPAL_LOCK_STATUSES.has(status);
}

function assertTransition(fromStatus, toStatus) {
    const from = fromStatus || 'pending';
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];

    if (!allowed.includes(toStatus)) {
        const err = new Error(`Transição inválida: ${from} → ${toStatus}`);
        err.statusCode = 400;
        throw err;
    }
}

async function insertEvent(client, {
    complaintId,
    tenantId,
    actorId,
    eventType,
    payload,
    isInternal = false,
}) {
    const { rows } = await client.query(
        `INSERT INTO public.complaint_events (
            complaint_id, tenant_id, actor_id, event_type, payload, is_internal
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)
         RETURNING id, event_type, payload, is_internal, created_at`,
        [
            complaintId,
            tenantId,
            actorId,
            eventType,
            JSON.stringify(payload ?? {}),
            isInternal,
        ]
    );

    return rows[0];
}

async function notifyWatchersAfterStatusChange(complaintId, fromStatus, toStatus, actorId) {
    if (fromStatus === toStatus) return;

    try {
        const pool = await supabasePool.getPgPool();
        const userIds = await watchService.notifyStatusChange(
            pool,
            complaintId,
            fromStatus,
            toStatus,
            actorId
        );
        if (userIds.length > 0) {
            pushService.sendComplaintStatus(complaintId, fromStatus, toStatus, userIds)
                .catch((err) => console.error('[push:status]', err.message));
        }
    } catch (err) {
        console.error('[watch:status]', err.message);
    }
}

async function transitionStatus(pool, {
    complaintId,
    tenantId,
    cdMun,
    actorId,
    toStatus,
    note,
    isInternal = false,
}) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const complaint = await getComplaintForTenant(pool, complaintId, tenantId, cdMun);
        if (!complaint) {
            const err = new Error('Ocorrência não encontrada.');
            err.statusCode = 404;
            throw err;
        }

        const fromStatus = complaint.status || 'pending';
        assertTransition(fromStatus, toStatus);

        let slaDueAt = complaint.sla_due_at;
        if (!slaDueAt && ['triaged', 'assigned', 'in_progress'].includes(toStatus)) {
            slaDueAt = await computeSlaDueAt(
                pool,
                tenantId,
                complaint.category_id,
                complaint.created_at
            );
        }

        let autoTeamId = null;
        if (
            ['triaged', 'assigned'].includes(toStatus) &&
            !complaint.assigned_ops_team_id
        ) {
            autoTeamId = await resolveAutoOpsTeam(
                pool,
                tenantId,
                complaint.category_id,
                complaint.cd_bairro
            );
        }

        const { rows } = await client.query(
            `UPDATE public.complaints
             SET status = $1::varchar,
                 sla_due_at = COALESCE($2, sla_due_at),
                 assigned_ops_team_id = COALESCE($4::uuid, assigned_ops_team_id),
                 assigned_at = CASE WHEN $4::uuid IS NOT NULL THEN NOW() ELSE assigned_at END,
                 resolved_at = CASE WHEN $1::varchar = 'resolved' THEN NOW() ELSE resolved_at END,
                 closed_at = CASE WHEN $1::varchar = 'closed' THEN NOW() ELSE closed_at END
             WHERE id = $3
             RETURNING id, status, sla_due_at, resolved_at, closed_at, priority,
                       assigned_ops_team_id, assigned_user_id, assigned_at, created_at`,
            [toStatus, slaDueAt, complaintId, autoTeamId]
        );

        const updated = rows[0];

        const event = await insertEvent(client, {
            complaintId,
            tenantId,
            actorId,
            eventType: 'status_change',
            payload: {
                from: fromStatus,
                to: toStatus,
                ...(note ? { note } : {}),
            },
            isInternal,
        });

        if (autoTeamId) {
            await insertEvent(client, {
                complaintId,
                tenantId,
                actorId,
                eventType: 'assignment',
                payload: { opsTeamId: autoTeamId, autoRouting: true },
                isInternal: true,
            });
        }

        await client.query('COMMIT');

        if (fromStatus !== toStatus) {
            notifyWatchersAfterStatusChange(complaintId, fromStatus, toStatus, actorId);
        }

        return {
            complaint: {
                ...updated,
                slaState: computeSlaState(updated.sla_due_at, updated.status),
            },
            event,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function assignComplaint(pool, {
    complaintId,
    tenantId,
    cdMun,
    actorId,
    opsTeamId,
    userId,
    priority,
    note,
    isInternal = true,
    autoAssignStatus = true,
}) {
    const hasTeamField = opsTeamId !== undefined;
    const hasUserField = userId !== undefined;
    const hasPriorityField = priority !== undefined;

    if (!hasTeamField && !hasUserField && !hasPriorityField) {
        const err = new Error('Informe equipe, responsável ou prioridade.');
        err.statusCode = 400;
        throw err;
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const complaint = await getComplaintForTenant(pool, complaintId, tenantId, cdMun);
        if (!complaint) {
            const err = new Error('Ocorrência não encontrada.');
            err.statusCode = 404;
            throw err;
        }

        let assignedTeamName = null;
        if (opsTeamId) {
            const { rows: teamRows } = await client.query(
                `SELECT id, name FROM public.ops_teams
                 WHERE id = $1::uuid AND tenant_id = $2::uuid AND is_active = true`,
                [opsTeamId, tenantId]
            );
            if (teamRows.length === 0) {
                const err = new Error('Equipe operacional inválida.');
                err.statusCode = 400;
                throw err;
            }
            assignedTeamName = teamRows[0].name;
        }

        if (userId) {
            const { rows: memberRows } = await client.query(
                `SELECT tm.user_id
                 FROM public.tenant_members tm
                 WHERE tm.user_id = $1::uuid
                   AND tm.tenant_id = $2::uuid
                   AND tm.is_active = true`,
                [userId, tenantId]
            );
            if (memberRows.length === 0) {
                const err = new Error('Responsável deve ser membro ativo do município.');
                err.statusCode = 400;
                throw err;
            }

            if (opsTeamId) {
                const { rows: opsMemberRows } = await client.query(
                    `SELECT user_id FROM public.ops_team_members
                     WHERE ops_team_id = $1::uuid AND user_id = $2::uuid AND is_active = true`,
                    [opsTeamId, userId]
                );
                if (opsMemberRows.length === 0) {
                    const err = new Error('Responsável deve pertencer à equipe selecionada.');
                    err.statusCode = 400;
                    throw err;
                }
            }
        }

        const teamChanged =
            hasTeamField && opsTeamId !== complaint.assigned_ops_team_id;
        const userChanged =
            hasUserField && userId !== complaint.assigned_user_id;

        let nextStatus = complaint.status || 'pending';
        if (
            autoAssignStatus &&
            (teamChanged || userChanged) &&
            ['pending', 'triaged'].includes(nextStatus)
        ) {
            nextStatus = 'assigned';
        }

        let slaDueAt = complaint.sla_due_at;
        if (!slaDueAt && (teamChanged || userChanged || nextStatus === 'assigned')) {
            slaDueAt = await computeSlaDueAt(
                pool,
                tenantId,
                complaint.category_id,
                complaint.created_at
            );
        }

        const nextTeamId = hasTeamField ? opsTeamId : complaint.assigned_ops_team_id;
        const nextUserId = hasUserField ? userId : complaint.assigned_user_id;
        const nextPriority = hasPriorityField ? priority : complaint.priority;

        const { rows } = await client.query(
            `UPDATE public.complaints
             SET assigned_ops_team_id = $1::uuid,
                 assigned_user_id = $2::uuid,
                 assigned_at = CASE WHEN $3 OR $4 THEN NOW() ELSE assigned_at END,
                 priority = $5::smallint,
                 status = $6::varchar,
                 sla_due_at = COALESCE($7, sla_due_at)
             WHERE id = $8
             RETURNING id, status, priority, sla_due_at, resolved_at, closed_at,
                       assigned_ops_team_id, assigned_user_id, assigned_at, created_at`,
            [
                nextTeamId,
                nextUserId,
                teamChanged,
                userChanged,
                nextPriority,
                nextStatus,
                slaDueAt,
                complaintId,
            ]
        );

        const updated = rows[0];

        const payload = {
            ...(opsTeamId !== undefined ? { opsTeamId } : {}),
            ...(userId !== undefined ? { userId } : {}),
            ...(priority !== undefined ? { priority } : {}),
            ...(note ? { note } : {}),
            ...(nextStatus !== complaint.status
                ? { statusFrom: complaint.status || 'pending', statusTo: nextStatus }
                : {}),
        };

        const event = await insertEvent(client, {
            complaintId,
            tenantId,
            actorId,
            eventType: 'assignment',
            payload,
            isInternal,
        });

        if (teamChanged && nextTeamId) {
            let teamName = assignedTeamName;
            if (!teamName) {
                const { rows: tn } = await client.query(
                    'SELECT name FROM public.ops_teams WHERE id = $1::uuid',
                    [nextTeamId]
                );
                teamName = tn[0]?.name ?? 'Equipe municipal';
            }
            await insertEvent(client, {
                complaintId,
                tenantId,
                actorId,
                eventType: 'assignment',
                payload: {
                    opsTeamId: nextTeamId,
                    opsTeamName: teamName,
                    public: true,
                },
                isInternal: false,
            });
        }

        const prevStatus = complaint.status || 'pending';
        await client.query('COMMIT');

        if (nextStatus !== prevStatus) {
            notifyWatchersAfterStatusChange(complaintId, prevStatus, nextStatus, actorId);
        }

        return {
            complaint: {
                ...updated,
                slaState: computeSlaState(updated.sla_due_at, updated.status),
            },
            event,
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function addNote(pool, {
    complaintId,
    tenantId,
    cdMun,
    actorId,
    text,
    isInternal = true,
}) {
    if (!text || !text.trim()) {
        const err = new Error('Texto da nota é obrigatório.');
        err.statusCode = 400;
        throw err;
    }

    const complaint = await getComplaintForTenant(pool, complaintId, tenantId, cdMun);
    if (!complaint) {
        const err = new Error('Ocorrência não encontrada.');
        err.statusCode = 404;
        throw err;
    }

    const event = await insertEvent(pool, {
        complaintId,
        tenantId,
        actorId,
        eventType: 'note',
        payload: { text: text.trim() },
        isInternal,
    });

    if (!isInternal && complaint.created_by) {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(
            `SELECT user_id FROM complaint_watchers
             WHERE complaint_id = $1::bigint AND muted_at IS NULL AND level = 'full'`,
            [complaintId]
        );
        const userIds = [...new Set(rows.map((r) => r.user_id))];
        for (const userId of userIds) {
            await pool.query(
                `INSERT INTO notifications (user_id, actor_id, type, reference_type, reference_id, payload)
                 VALUES ($1, $2, 'complaint_status', 'complaint', $3, $4::jsonb)`,
                [
                    userId,
                    actorId,
                    String(complaintId),
                    JSON.stringify({
                        complaint_id: String(complaintId),
                        title: 'Nova nota da prefeitura',
                        body: text.trim().slice(0, 120),
                    }),
                ]
            ).catch((err) => console.error('[notification:note]', err.message));
        }
    }

    return { event };
}

async function listEvents(pool, complaintId, tenantId, cdMun, { includeInternal = true } = {}) {
    const complaint = await getComplaintForTenant(pool, complaintId, tenantId, cdMun);
    if (!complaint) {
        const err = new Error('Ocorrência não encontrada.');
        err.statusCode = 404;
        throw err;
    }

    const internalFilter = includeInternal ? '' : 'AND ce.is_internal = false';

    const { rows } = await pool.query(
        `SELECT
            ce.id,
            ce.event_type,
            ce.payload,
            ce.is_internal,
            ce.created_at,
            u.name AS actor_name
         FROM public.complaint_events ce
         LEFT JOIN public.users u ON u.id = ce.actor_id
         WHERE ce.complaint_id = $1::bigint
           AND ce.tenant_id = $2::uuid
           ${internalFilter}
         ORDER BY ce.created_at DESC`,
        [complaintId, tenantId]
    );

    return rows;
}

module.exports = {
    ALLOWED_TRANSITIONS,
    getComplaintForTenant,
    isUnderMunicipalManagement,
    transitionStatus,
    assignComplaint,
    addNote,
    listEvents,
    TERMINAL_STATUSES,
};
