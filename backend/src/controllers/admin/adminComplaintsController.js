const supabasePool = require('../../infra/supabasePool');
const { listBlobs } = require('../../infra/supabaseStorageClient');
const { TENANT_COMPLAINT_FILTER } = require('../../services/tenantService');
const { computeSlaState, slaFilterClause } = require('../../services/slaService');
const workflow = require('../../services/complaintWorkflowService');

function buildComplaintFilters(query, tenantId, cdMun) {
    const conditions = [TENANT_COMPLAINT_FILTER.trim()];
    const values = [tenantId, cdMun];
    let paramIndex = 3;

    if (query.category) {
        conditions.push(`(cat.slug = $${paramIndex} OR c.category = $${paramIndex})`);
        values.push(query.category);
        paramIndex += 1;
    }

    if (query.from) {
        conditions.push(`c.created_at >= $${paramIndex}::timestamptz`);
        values.push(query.from);
        paramIndex += 1;
    }

    if (query.to) {
        conditions.push(`c.created_at <= $${paramIndex}::timestamptz`);
        values.push(query.to);
        paramIndex += 1;
    }

    return {
        whereClause: conditions.join(' AND '),
        values,
        nextParamIndex: paramIndex,
    };
}

function mapInboxRow(row) {
    const status = row.status || 'pending';
    return {
        id: row.id,
        category: row.category,
        categoryName: row.category_name,
        categoryColor: row.category_color,
        status,
        priority: row.priority,
        address: row.address,
        created_at: row.created_at,
        sla_due_at: row.sla_due_at,
        slaState: computeSlaState(row.sla_due_at, status),
        assignedOpsTeamId: row.assigned_ops_team_id,
        assignedOpsTeamName: row.assigned_ops_team_name,
        assignedUserName: row.assigned_user_name,
        cd_bairro: row.cd_bairro,
        bairroName: row.bairro_name,
    };
}

const COMPLAINT_DETAIL_SELECT = `
    c.id,
    c.description,
    c.occurrence_date,
    COALESCE(cat.slug, c.category) AS category,
    COALESCE(cat.name, c.category) AS category_name,
    cat.color_hex AS category_color,
    cat.icon_key AS category_icon,
    COALESCE(c.status, 'pending') AS status,
    c.address,
    CASE WHEN c.latitude IS NOT NULL THEN c.latitude::float8 END AS latitude,
    CASE WHEN c.longitude IS NOT NULL THEN c.longitude::float8 END AS longitude,
    c.cd_mun,
    c.cd_setor,
    c.cd_bairro,
    b.nm_bairro AS bairro_name,
    c.is_within_city,
    c.created_at,
    c.created_by,
    c.category_id,
    c.priority,
    c.sla_due_at,
    c.resolved_at,
    c.closed_at,
    c.assigned_at,
    c.assigned_ops_team_id,
    ot.name AS assigned_ops_team_name,
    c.assigned_user_id,
    au.name AS assigned_user_name,
    u.name AS reporter_name,
    u.email AS reporter_email,
    u.phone AS reporter_phone
`;

function enrichComplaintDetail(row) {
    const status = row.status || 'pending';
    return {
        ...row,
        sla_state: computeSlaState(row.sla_due_at, status),
    };
}

exports.list = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const { whereClause, values } = buildComplaintFilters(
            req.query,
            req.tenant.id,
            req.tenant.cd_mun
        );

        const { rows } = await pool.query(
            `SELECT
                c.id,
                COALESCE(cat.slug, c.category) AS category,
                COALESCE(cat.name, c.category) AS category_name,
                cat.color_hex AS category_color,
                cat.icon_key AS category_icon,
                COALESCE(c.status, 'pending') AS status,
                CASE WHEN c.latitude IS NOT NULL THEN c.latitude::float8 END AS latitude,
                CASE WHEN c.longitude IS NOT NULL THEN c.longitude::float8 END AS longitude,
                c.cd_setor,
                c.cd_bairro,
                c.created_at,
                c.address
             FROM public.complaints c
             LEFT JOIN public.complaint_categories cat ON cat.id = c.category_id
             WHERE ${whereClause}
             ORDER BY c.created_at DESC`,
            values
        );

        res.status(200).json({ complaints: rows });
    } catch (error) {
        console.error('Erro ao buscar reclamações admin:', error);
        res.status(500).json({ message: 'Erro ao buscar reclamações.' });
    }
};

function buildInboxQuery(req) {
    const tenantId = req.tenant.id;
    const cdMun = req.tenant.cd_mun;
    const role = req.tenant.role;

    const sortColumns = {
        created_at: 'c.created_at',
        sla_due_at: 'c.sla_due_at',
        priority: 'c.priority',
    };
    const sortCol = sortColumns[req.query.sort] || sortColumns.created_at;
    const sortOrder = req.query.order === 'asc' ? 'ASC' : 'DESC';

    const base = buildComplaintFilters(req.query, tenantId, cdMun);
    const conditions = [base.whereClause];
    const values = [...base.values];
    let paramIndex = base.nextParamIndex;

    if (req.query.status) {
        const statuses = req.query.status.split(',').map((s) => s.trim()).filter(Boolean);
        if (statuses.length > 0) {
            conditions.push(`COALESCE(c.status, 'pending') = ANY($${paramIndex}::text[])`);
            values.push(statuses);
            paramIndex += 1;
        }
    }

    if (req.query.opsTeamId) {
        conditions.push(`c.assigned_ops_team_id = $${paramIndex}::uuid`);
        values.push(req.query.opsTeamId);
        paramIndex += 1;
    }

    if (req.query.priority) {
        conditions.push(`c.priority = $${paramIndex}::smallint`);
        values.push(parseInt(req.query.priority, 10));
        paramIndex += 1;
    }

    if (req.query.cd_bairro) {
        conditions.push(`c.cd_bairro = $${paramIndex}`);
        values.push(req.query.cd_bairro);
        paramIndex += 1;
    }

    if (req.query.q) {
        conditions.push(`(
            c.id::text ILIKE $${paramIndex}
            OR COALESCE(c.address, '') ILIKE $${paramIndex}
            OR COALESCE(c.description, '') ILIKE $${paramIndex}
        )`);
        values.push(`%${req.query.q.trim()}%`);
        paramIndex += 1;
    }

    const slaFilter = slaFilterClause(req.query.sla);
    if (slaFilter.clause) {
        conditions.push(slaFilter.clause);
    }

    const scope = req.query.scope || (role === 'operator' ? 'mine' : 'all');

    if (scope === 'mine' && role === 'operator') {
        conditions.push(`(
            c.assigned_ops_team_id IS NULL
            OR c.assigned_ops_team_id IN (
                SELECT otm.ops_team_id
                FROM public.ops_team_members otm
                JOIN public.ops_teams ot ON ot.id = otm.ops_team_id
                WHERE otm.user_id = $${paramIndex}::uuid
                  AND otm.is_active = true
                  AND ot.tenant_id = $1::uuid
                  AND ot.is_active = true
            )
        )`);
        values.push(req.user.id);
        paramIndex += 1;
    }

    if (req.query.assignedToMe === 'true' && role !== 'viewer') {
        conditions.push(`c.assigned_user_id = $${paramIndex}::uuid`);
        values.push(req.user.id);
        paramIndex += 1;
    }

    return {
        whereClause: conditions.join(' AND '),
        values,
        paramIndex,
        sortCol,
        sortOrder,
    };
}

function csvEscape(value) {
    if (value == null) {
        return '';
    }
    const str = String(value);
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

exports.inbox = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
        const offset = (page - 1) * pageSize;

        const { whereClause, values, paramIndex, sortCol, sortOrder } = buildInboxQuery(req);

        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM public.complaints c
             LEFT JOIN public.complaint_categories cat ON cat.id = c.category_id
             WHERE ${whereClause}`,
            values
        );

        const total = countResult.rows[0].total;

        const queryValues = [...values, pageSize, offset];

        const { rows } = await pool.query(
            `SELECT
                c.id,
                COALESCE(cat.slug, c.category) AS category,
                COALESCE(cat.name, c.category) AS category_name,
                cat.color_hex AS category_color,
                COALESCE(c.status, 'pending') AS status,
                c.priority,
                c.address,
                c.created_at,
                c.sla_due_at,
                c.assigned_ops_team_id,
                ot.name AS assigned_ops_team_name,
                au.name AS assigned_user_name,
                c.cd_bairro,
                b.nm_bairro AS bairro_name
             FROM public.complaints c
             LEFT JOIN public.complaint_categories cat ON cat.id = c.category_id
             LEFT JOIN public.ops_teams ot ON ot.id = c.assigned_ops_team_id
             LEFT JOIN public.users au ON au.id = c.assigned_user_id
             LEFT JOIN malhas.bairros b
               ON b.cd_bairro = c.cd_bairro AND b.cd_mun = c.cd_mun::varchar
             WHERE ${whereClause}
             ORDER BY ${sortCol} ${sortOrder} NULLS LAST
             LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            queryValues
        );

        res.status(200).json({
            items: rows.map(mapInboxRow),
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize) || 0,
            },
        });
    } catch (error) {
        console.error('Erro ao buscar inbox admin:', error);
        res.status(500).json({ message: 'Erro ao buscar fila de ocorrências.' });
    }
};

exports.exportCsv = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const { whereClause, values, paramIndex, sortCol, sortOrder } = buildInboxQuery(req);
        const limit = 5000;

        const exportValues = [...values, limit];

        const { rows } = await pool.query(
            `SELECT
                c.id,
                COALESCE(c.status, 'pending') AS status,
                COALESCE(cat.name, c.category) AS category_name,
                COALESCE(b.nm_bairro, c.cd_bairro) AS bairro_name,
                c.created_at,
                c.sla_due_at,
                ot.name AS assigned_ops_team_name,
                c.priority
             FROM public.complaints c
             LEFT JOIN public.complaint_categories cat ON cat.id = c.category_id
             LEFT JOIN public.ops_teams ot ON ot.id = c.assigned_ops_team_id
             LEFT JOIN malhas.bairros b
               ON b.cd_bairro = c.cd_bairro AND b.cd_mun = c.cd_mun::varchar
             WHERE ${whereClause}
             ORDER BY ${sortCol} ${sortOrder} NULLS LAST
             LIMIT $${paramIndex}`,
            exportValues
        );

        const header = [
            'id',
            'status',
            'categoria',
            'bairro',
            'criada_em',
            'sla_due_at',
            'equipe',
            'prioridade',
        ].join(',');

        const lines = rows.map((row) =>
            [
                row.id,
                row.status,
                row.category_name,
                row.bairro_name,
                row.created_at?.toISOString?.() ?? row.created_at,
                row.sla_due_at?.toISOString?.() ?? row.sla_due_at ?? '',
                row.assigned_ops_team_name,
                row.priority,
            ]
                .map(csvEscape)
                .join(',')
        );

        const csv = [header, ...lines].join('\n');
        const filename = `ocorrencias-${new Date().toISOString().slice(0, 10)}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(`\uFEFF${csv}`);
    } catch (error) {
        console.error('Erro ao exportar ocorrências:', error);
        res.status(500).json({ message: 'Erro ao exportar ocorrências.' });
    }
};

exports.getById = async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await supabasePool.getPgPool();
        const filter = TENANT_COMPLAINT_FILTER.trim();
        const params = [req.tenant.id, req.tenant.cd_mun, id];

        const { rows } = await pool.query(
            `SELECT ${COMPLAINT_DETAIL_SELECT}
             FROM public.complaints c
             LEFT JOIN public.complaint_categories cat ON cat.id = c.category_id
             LEFT JOIN public.users u ON u.id = c.created_by
             LEFT JOIN public.ops_teams ot ON ot.id = c.assigned_ops_team_id
             LEFT JOIN public.users au ON au.id = c.assigned_user_id
             LEFT JOIN malhas.bairros b
               ON b.cd_bairro = c.cd_bairro AND b.cd_mun = c.cd_mun::varchar
             WHERE c.id = $3::bigint AND ${filter}`,
            params
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Ocorrência não encontrada.' });
        }

        const photos = await listBlobs('complaints', id.toString(), 3600);

        res.status(200).json({
            complaint: enrichComplaintDetail(rows[0]),
            photos,
        });
    } catch (error) {
        console.error('Erro ao buscar ocorrência admin:', error);
        res.status(500).json({ message: 'Erro ao buscar ocorrência.' });
    }
};

exports.patchStatus = async (req, res) => {
    const { id } = req.params;
    const { status, note, isInternal } = req.body ?? {};

    if (!status) {
        return res.status(400).json({ message: 'Status é obrigatório.' });
    }

    try {
        const pool = await supabasePool.getPgPool();
        const result = await workflow.transitionStatus(pool, {
            complaintId: id,
            tenantId: req.tenant.id,
            cdMun: req.tenant.cd_mun,
            actorId: req.user.id,
            toStatus: status,
            note,
            isInternal: Boolean(isInternal),
        });

        res.status(200).json(result);
    } catch (error) {
        const code = error.statusCode || 500;
        if (code >= 500) {
            console.error('Erro ao atualizar status admin:', error);
        }
        res.status(code).json({ message: error.message || 'Erro ao atualizar status.' });
    }
};

exports.patchAssignment = async (req, res) => {
    const { id } = req.params;
    const { opsTeamId, userId, priority, note, isInternal } = req.body ?? {};

    try {
        const pool = await supabasePool.getPgPool();
        const result = await workflow.assignComplaint(pool, {
            complaintId: id,
            tenantId: req.tenant.id,
            cdMun: req.tenant.cd_mun,
            actorId: req.user.id,
            opsTeamId,
            userId,
            priority,
            note,
            isInternal: isInternal !== false,
        });

        res.status(200).json(result);
    } catch (error) {
        const code = error.statusCode || 500;
        if (code >= 500) {
            console.error('Erro ao atribuir ocorrência admin:', error);
        }
        res.status(code).json({ message: error.message || 'Erro ao atribuir ocorrência.' });
    }
};

exports.postNote = async (req, res) => {
    const { id } = req.params;
    const { text, isInternal } = req.body ?? {};

    try {
        const pool = await supabasePool.getPgPool();
        const result = await workflow.addNote(pool, {
            complaintId: id,
            tenantId: req.tenant.id,
            cdMun: req.tenant.cd_mun,
            actorId: req.user.id,
            text,
            isInternal: isInternal !== false,
        });

        res.status(201).json(result);
    } catch (error) {
        const code = error.statusCode || 500;
        if (code >= 500) {
            console.error('Erro ao registar nota admin:', error);
        }
        res.status(code).json({ message: error.message || 'Erro ao registar nota.' });
    }
};

exports.getEvents = async (req, res) => {
    const { id } = req.params;
    const includeInternal = req.query.includeInternal !== 'false';

    try {
        const pool = await supabasePool.getPgPool();
        const events = await workflow.listEvents(
            pool,
            id,
            req.tenant.id,
            req.tenant.cd_mun,
            { includeInternal }
        );

        res.status(200).json({ events });
    } catch (error) {
        const code = error.statusCode || 500;
        if (code >= 500) {
            console.error('Erro ao buscar eventos admin:', error);
        }
        res.status(code).json({ message: error.message || 'Erro ao buscar timeline.' });
    }
};
