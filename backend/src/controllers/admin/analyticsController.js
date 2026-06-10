const supabasePool = require('../../infra/supabasePool');
const { TENANT_COMPLAINT_FILTER } = require('../../services/tenantService');

function tenantParams(tenant) {
    return [tenant.id, tenant.cd_mun];
}

exports.summary = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const params = tenantParams(req.tenant);

        const [statsResult, coverageResult, operationalResult] = await Promise.all([
            pool.query(
                `SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (WHERE COALESCE(c.status, 'pending') = 'pending')::int AS pending,
                    COUNT(*) FILTER (WHERE c.created_at >= now() - interval '7 days')::int AS last7days,
                    COUNT(DISTINCT COALESCE(c.category_id::text, c.category))::int AS distinct_categories
                 FROM public.complaints c
                 WHERE ${TENANT_COMPLAINT_FILTER.trim()}`,
                params
            ),
            pool.query(
                `SELECT
                    EXISTS(SELECT 1 FROM malhas.bairros b WHERE b.cd_mun = $1::char(7) LIMIT 1) AS bairros_loaded,
                    EXISTS(SELECT 1 FROM malhas.setores s WHERE s.cd_mun = $1::char(7) LIMIT 1) AS setores_loaded`,
                [req.tenant.cd_mun]
            ),
            pool.query(
                `SELECT
                    COUNT(*) FILTER (
                        WHERE COALESCE(c.status, 'pending') NOT IN ('resolved', 'closed', 'cancelled')
                    )::int AS backlog,
                    COUNT(*) FILTER (
                        WHERE c.sla_due_at IS NOT NULL
                          AND c.sla_due_at >= NOW()
                          AND c.sla_due_at < NOW() + INTERVAL '24 hours'
                          AND COALESCE(c.status, 'pending') NOT IN ('resolved', 'closed', 'cancelled')
                    )::int AS sla_at_risk,
                    COUNT(*) FILTER (
                        WHERE c.sla_due_at IS NOT NULL
                          AND c.sla_due_at < NOW()
                          AND COALESCE(c.status, 'pending') NOT IN ('resolved', 'closed', 'cancelled')
                    )::int AS sla_breached
                 FROM public.complaints c
                 WHERE ${TENANT_COMPLAINT_FILTER.trim()}`,
                params
            ),
        ]);

        const stats = statsResult.rows[0];
        const coverage = coverageResult.rows[0];
        const operational = operationalResult.rows[0];

        res.status(200).json({
            total: stats.total,
            pending: stats.pending,
            last7Days: stats.last7days,
            distinctCategories: stats.distinct_categories,
            coverage: {
                bairrosLoaded: coverage.bairros_loaded,
                setoresLoaded: coverage.setores_loaded,
            },
            operational: {
                backlog: operational.backlog,
                slaAtRisk: operational.sla_at_risk,
                slaBreached: operational.sla_breached,
            },
        });
    } catch (error) {
        console.error('Erro ao buscar summary analytics:', error);
        res.status(500).json({ message: 'Erro ao buscar resumo analítico.' });
    }
};

exports.byCategory = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const params = tenantParams(req.tenant);

        const { rows } = await pool.query(
            `WITH scoped AS (
                SELECT
                    COALESCE(cat.slug, NULLIF(TRIM(c.category), ''), 'outros') AS slug,
                    COALESCE(cat.name, 'Sem categoria') AS name,
                    COALESCE(cat.color_hex, '#BDBDBD') AS color_hex,
                    COALESCE(cat.icon_key, 'help_outline') AS icon_key
                FROM public.complaints c
                LEFT JOIN public.complaint_categories cat ON cat.id = c.category_id
                WHERE ${TENANT_COMPLAINT_FILTER.trim()}
             ),
             counts AS (
                SELECT slug, name, color_hex, icon_key, COUNT(*)::int AS count
                FROM scoped
                GROUP BY slug, name, color_hex, icon_key
             ),
             total AS (
                SELECT COALESCE(SUM(count), 0)::int AS total FROM counts
             )
             SELECT
                counts.slug,
                counts.name,
                counts.color_hex,
                counts.icon_key,
                counts.count,
                CASE
                    WHEN total.total = 0 THEN 0
                    ELSE ROUND((counts.count::numeric / total.total) * 100, 1)
                END AS percent
             FROM counts, total
             ORDER BY counts.count DESC`,
            params
        );

        res.status(200).json({
            items: rows.map((row) => ({
                slug: row.slug,
                name: row.name,
                category: row.name,
                colorHex: row.color_hex,
                iconKey: row.icon_key,
                count: row.count,
                percent: Number(row.percent),
            })),
        });
    } catch (error) {
        console.error('Erro ao buscar analytics por categoria:', error);
        res.status(500).json({ message: 'Erro ao buscar distribuição por categoria.' });
    }
};

exports.rankingAreas = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const params = tenantParams(req.tenant);
        const filter = TENANT_COMPLAINT_FILTER.trim();

        const [setorResult, bairroResult] = await Promise.all([
            pool.query(
                `SELECT
                    c.cd_setor AS code,
                    c.cd_setor AS label,
                    COUNT(*)::int AS count
                 FROM public.complaints c
                 WHERE ${filter} AND c.cd_setor IS NOT NULL
                 GROUP BY c.cd_setor
                 ORDER BY count DESC
                 LIMIT 10`,
                params
            ),
            pool.query(
                `SELECT
                    c.cd_bairro AS code,
                    COALESCE(b.nm_bairro, c.cd_bairro) AS label,
                    COUNT(*)::int AS count
                 FROM public.complaints c
                 LEFT JOIN malhas.bairros b
                   ON b.cd_bairro = c.cd_bairro AND b.cd_mun = $2::char(7)
                 WHERE ${filter} AND c.cd_bairro IS NOT NULL
                 GROUP BY c.cd_bairro, b.nm_bairro
                 ORDER BY count DESC
                 LIMIT 10`,
                params
            ),
        ]);

        res.status(200).json({
            bySetor: setorResult.rows,
            byBairro: bairroResult.rows,
        });
    } catch (error) {
        console.error('Erro ao buscar ranking de áreas:', error);
        res.status(500).json({ message: 'Erro ao buscar ranking de áreas.' });
    }
};

exports.operations = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const params = tenantParams(req.tenant);
        const filter = TENANT_COMPLAINT_FILTER.trim();

        const [kpiResult, resolutionResult, triagemResult, byTeamResult, byStatusResult] =
            await Promise.all([
                pool.query(
                    `SELECT
                        COUNT(*) FILTER (
                            WHERE COALESCE(c.status, 'pending') NOT IN ('resolved', 'closed', 'cancelled')
                        )::int AS backlog,
                        COUNT(*) FILTER (
                            WHERE c.sla_due_at IS NOT NULL
                              AND c.sla_due_at >= NOW()
                              AND c.sla_due_at < NOW() + INTERVAL '24 hours'
                              AND COALESCE(c.status, 'pending') NOT IN ('resolved', 'closed', 'cancelled')
                        )::int AS sla_at_risk,
                        COUNT(*) FILTER (
                            WHERE c.sla_due_at IS NOT NULL
                              AND c.sla_due_at < NOW()
                              AND COALESCE(c.status, 'pending') NOT IN ('resolved', 'closed', 'cancelled')
                        )::int AS sla_breached
                     FROM public.complaints c
                     WHERE ${filter}`,
                    params
                ),
                pool.query(
                    `SELECT AVG(
                        EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 3600.0
                     ) AS avg_hours
                     FROM public.complaints c
                     WHERE ${filter}
                       AND c.resolved_at IS NOT NULL`,
                    params
                ),
                pool.query(
                    `SELECT AVG(
                        EXTRACT(EPOCH FROM (c.assigned_at - c.created_at)) / 3600.0
                     ) AS avg_hours
                     FROM public.complaints c
                     WHERE ${filter}
                       AND c.assigned_at IS NOT NULL`,
                    params
                ),
                pool.query(
                    `SELECT
                        ot.id AS ops_team_id,
                        ot.name,
                        COUNT(*) FILTER (
                            WHERE COALESCE(c.status, 'pending') NOT IN ('resolved', 'closed', 'cancelled')
                        )::int AS backlog,
                        COUNT(*) FILTER (
                            WHERE c.resolved_at >= NOW() - INTERVAL '7 days'
                        )::int AS resolved_last_7_days,
                        CASE
                            WHEN COUNT(*) FILTER (
                                WHERE c.sla_due_at IS NOT NULL
                                  AND c.resolved_at IS NOT NULL
                            ) = 0 THEN NULL
                            ELSE ROUND(
                                100.0 * COUNT(*) FILTER (
                                    WHERE c.resolved_at IS NOT NULL
                                      AND c.sla_due_at IS NOT NULL
                                      AND c.resolved_at <= c.sla_due_at
                                ) / NULLIF(COUNT(*) FILTER (
                                    WHERE c.sla_due_at IS NOT NULL
                                      AND c.resolved_at IS NOT NULL
                                ), 0),
                                1
                            )
                        END AS sla_compliance_percent
                     FROM public.ops_teams ot
                     LEFT JOIN public.complaints c
                       ON c.assigned_ops_team_id = ot.id AND ${filter}
                     WHERE ot.tenant_id = $1::uuid AND ot.is_active = true
                     GROUP BY ot.id, ot.name
                     ORDER BY ot.name`,
                    params
                ),
                pool.query(
                    `SELECT
                        COALESCE(c.status, 'pending') AS status,
                        COUNT(*)::int AS count
                     FROM public.complaints c
                     WHERE ${filter}
                     GROUP BY COALESCE(c.status, 'pending')
                     ORDER BY count DESC`,
                    params
                ),
            ]);

        const kpi = kpiResult.rows[0];
        const avgResolution = resolutionResult.rows[0].avg_hours;
        const avgTriagem = triagemResult.rows[0].avg_hours;

        res.status(200).json({
            backlog: kpi.backlog,
            slaAtRisk: kpi.sla_at_risk,
            slaBreached: kpi.sla_breached,
            avgResolutionHours: avgResolution != null ? Number(Number(avgResolution).toFixed(1)) : null,
            avgTriagemHours: avgTriagem != null ? Number(Number(avgTriagem).toFixed(1)) : null,
            byTeam: byTeamResult.rows.map((row) => ({
                opsTeamId: row.ops_team_id,
                name: row.name,
                backlog: row.backlog,
                resolvedLast7Days: row.resolved_last_7_days,
                slaCompliancePercent:
                    row.sla_compliance_percent != null
                        ? Number(row.sla_compliance_percent)
                        : null,
            })),
            byStatus: byStatusResult.rows.map((row) => ({
                status: row.status,
                count: row.count,
            })),
        });
    } catch (error) {
        console.error('Erro ao buscar analytics operacionais:', error);
        res.status(500).json({ message: 'Erro ao buscar analytics operacionais.' });
    }
};
