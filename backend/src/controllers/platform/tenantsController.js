const supabasePool = require('../../infra/supabasePool');
const { writeAuditLog } = require('../../services/platformService');
const {
    resolvePopulation,
    estimateBilling,
    toBillingSnapshot,
} = require('../../services/billingEstimateService');
const {
    createTenant,
    formatTenantRow,
    deepMerge,
    getCoverage,
    getTenantHealth,
    SLUG_REGEX,
} = require('../../services/tenantOnboardingService');

exports.list = async (req, res) => {
    const {
        status,
        q,
        page = 1,
        pageSize = 25,
        sort = 'created_at',
        order = 'desc',
    } = req.query;

    const limit = Math.min(Math.max(parseInt(pageSize, 10) || 25, 1), 100);
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;
    const sortCol = ['created_at', 'display_name', 'status'].includes(sort) ? sort : 'created_at';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';

    try {
        const pool = await supabasePool.getPgPool();
        const conditions = [];
        const params = [];
        let idx = 1;

        if (status) {
            conditions.push(`t.status = $${idx++}`);
            params.push(status);
        }
        if (q?.trim()) {
            conditions.push(`(t.slug ILIKE $${idx} OR t.display_name ILIKE $${idx} OR t.cd_mun ILIKE $${idx})`);
            params.push(`%${q.trim()}%`);
            idx++;
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS total FROM tenants t ${where}`,
            params
        );
        const total = countResult.rows[0]?.total ?? 0;

        const { rows } = await pool.query(
            `SELECT t.*,
                    (SELECT COUNT(*)::int FROM tenant_members tm
                     WHERE tm.tenant_id = t.id AND tm.is_active) AS member_count,
                    (SELECT COUNT(*)::int FROM complaints c
                     WHERE c.tenant_id = t.id
                        OR (c.tenant_id IS NULL AND c.cd_mun = t.cd_mun)) AS complaint_count
             FROM tenants t
             ${where}
             ORDER BY t.${sortCol} ${sortDir}
             LIMIT $${idx++} OFFSET $${idx++}`,
            [...params, limit, offset]
        );

        const items = await Promise.all(rows.map(async (row) => {
            const cd_mun = row.cd_mun?.trim?.() ?? row.cd_mun;
            const coverage = await getCoverage(pool, cd_mun);
            return {
                id: row.id,
                cd_mun,
                slug: row.slug,
                displayName: row.display_name,
                status: row.status,
                activatedAt: row.activated_at,
                createdAt: row.created_at,
                memberCount: row.member_count,
                complaintCount: row.complaint_count,
                coverage: {
                    bairrosLoaded: coverage.bairrosLoaded,
                    setoresLoaded: coverage.setoresLoaded,
                },
            };
        }));

        res.status(200).json({
            items,
            pagination: {
                page: Math.max(parseInt(page, 10) || 1, 1),
                pageSize: limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        console.error('Erro ao listar tenants:', error);
        res.status(500).json({ message: 'Erro ao listar clientes.' });
    }
};

exports.create = async (req, res) => {
    const {
        cd_mun,
        slug,
        displayName,
        status = 'trial',
        settings = {},
        seedDefaults = true,
        billing = {},
        inviteOwner,
    } = req.body ?? {};

    if (!cd_mun || !slug) {
        return res.status(400).json({ message: 'cd_mun e slug são obrigatórios.' });
    }

    try {
        const pool = await supabasePool.getPgPool();
        const { tenant, seed, coverage, invitation } = await createTenant(pool, {
            cd_mun,
            slug,
            displayName,
            status,
            settings,
            seedDefaults,
            billing,
            inviteOwner,
            actorId: req.user.id,
        });

        res.status(201).json({
            tenant: formatTenantRow(tenant),
            seed,
            invitation,
            coverage,
        });
    } catch (error) {
        console.error('Erro ao criar tenant:', error);
        res.status(error.status || 500).json({ message: error.message || 'Erro ao criar cliente.' });
    }
};

exports.get = async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query('SELECT * FROM tenants WHERE id = $1', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }

        const tenant = rows[0];
        const cd_mun = tenant.cd_mun?.trim?.() ?? tenant.cd_mun;

        const complaintScope = `
            c.tenant_id = $1::uuid OR (c.tenant_id IS NULL AND c.cd_mun = $2::char(7))
        `;

        const [stats, coverage] = await Promise.all([
            pool.query(
                `SELECT
                    (SELECT COUNT(*)::int FROM tenant_members WHERE tenant_id = $1 AND is_active) AS member_count,
                    (SELECT COUNT(*)::int FROM complaints c WHERE ${complaintScope}) AS complaint_count,
                    (SELECT COUNT(*)::int FROM complaints c
                     WHERE (${complaintScope}) AND c.created_at >= NOW() - INTERVAL '7 days') AS complaints_last_7_days,
                    (SELECT COUNT(*)::int FROM users u WHERE u.home_cd_mun = $2) AS citizen_count,
                    (SELECT COUNT(*)::int FROM ops_teams WHERE tenant_id = $1 AND is_active) AS ops_team_count,
                    (SELECT COUNT(*)::int FROM complaints c
                     WHERE (${complaintScope})
                       AND COALESCE(c.status, 'pending') IN ('resolved', 'closed')) AS resolved_count,
                    (SELECT AVG(
                        EXTRACT(EPOCH FROM (COALESCE(c.resolved_at, c.closed_at) - c.created_at)) / 86400.0
                     )
                     FROM complaints c
                     WHERE (${complaintScope})
                       AND COALESCE(c.status, 'pending') IN ('resolved', 'closed')
                       AND COALESCE(c.resolved_at, c.closed_at) IS NOT NULL) AS avg_resolution_days`,
                [id, cd_mun]
            ),
            getCoverage(pool, cd_mun),
        ]);

        const s = stats.rows[0];
        const complaintCount = s.complaint_count ?? 0;
        const resolvedCount = s.resolved_count ?? 0;
        const resolutionRatePct =
            complaintCount > 0
                ? Math.round((resolvedCount / complaintCount) * 1000) / 10
                : null;

        res.status(200).json({
            tenant: formatTenantRow(tenant),
            stats: {
                memberCount: s.member_count,
                complaintCount,
                complaintsLast7Days: s.complaints_last_7_days,
                citizenCount: s.citizen_count,
                opsTeamCount: s.ops_team_count,
                resolvedCount,
                resolutionRatePct,
                avgResolutionDays:
                    s.avg_resolution_days != null
                        ? Math.round(Number(s.avg_resolution_days) * 10) / 10
                        : null,
            },
            coverage,
        });
    } catch (error) {
        console.error('Erro ao buscar tenant:', error);
        res.status(500).json({ message: 'Erro ao buscar cliente.' });
    }
};

exports.patch = async (req, res) => {
    const { id } = req.params;
    const { displayName, slug, status, settings, billing } = req.body ?? {};

    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query('SELECT * FROM tenants WHERE id = $1', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }

        const current = rows[0];
        const updates = [];
        const params = [];
        let idx = 1;

        if (displayName !== undefined) {
            updates.push(`display_name = $${idx++}`);
            params.push(displayName);
        }

        if (slug !== undefined) {
            const normalizedSlug = String(slug).toLowerCase().trim();
            if (!SLUG_REGEX.test(normalizedSlug)) {
                return res.status(400).json({ message: 'Slug inválido.' });
            }
            const { rows: slugConflict } = await pool.query(
                'SELECT id FROM tenants WHERE slug = $1 AND id != $2',
                [normalizedSlug, id]
            );
            if (slugConflict.length > 0) {
                return res.status(409).json({ message: 'Slug já existe.' });
            }
            updates.push(`slug = $${idx++}`);
            params.push(normalizedSlug);
        }

        let auditAction = 'tenant.update';

        if (status !== undefined) {
            if (!['trial', 'active', 'suspended'].includes(status)) {
                return res.status(400).json({ message: 'Status inválido.' });
            }
            if (status === 'suspended' && req.platform.role !== 'admin') {
                return res.status(403).json({ message: 'Apenas admin platform pode suspender clientes.' });
            }
            auditAction = status === 'suspended' ? 'tenant.suspend' : 'tenant.activate';
            updates.push(`status = $${idx++}`);
            params.push(status);
        }

        let mergedSettings = current.settings ?? {};
        if (settings !== undefined) {
            mergedSettings = deepMerge(mergedSettings, settings);
        }
        if (billing !== undefined) {
            const cd_mun = current.cd_mun?.trim?.() ?? current.cd_mun;
            const { population, populationSource } = await resolvePopulation(
                pool,
                cd_mun,
                billing.populationOverride ?? null
            );
            const estimate = estimateBilling({
                population,
                contractMonths: billing.contractMonths ?? mergedSettings.billing?.contract_months,
            });
            mergedSettings = deepMerge(mergedSettings, {
                billing: toBillingSnapshot(estimate, populationSource),
            });
        }

        if (settings !== undefined || billing !== undefined) {
            updates.push(`settings = $${idx++}`);
            params.push(JSON.stringify(mergedSettings));
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'Nenhum campo para atualizar.' });
        }

        params.push(id);
        const { rows: updated } = await pool.query(
            `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );

        await writeAuditLog(pool, {
            actorId: req.user.id,
            action: auditAction,
            targetType: 'tenant',
            targetId: id,
            tenantId: id,
            payload: req.body,
        });

        res.status(200).json({ tenant: formatTenantRow(updated[0]) });
    } catch (error) {
        console.error('Erro ao atualizar tenant:', error);
        res.status(500).json({ message: 'Erro ao atualizar cliente.' });
    }
};

exports.health = async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await supabasePool.getPgPool();
        const health = await getTenantHealth(pool, id);
        if (!health) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }
        res.status(200).json(health);
    } catch (error) {
        console.error('Erro no health check:', error);
        res.status(500).json({ message: 'Erro ao verificar saúde do cliente.' });
    }
};
