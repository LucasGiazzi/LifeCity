const supabasePool = require('../../infra/supabasePool');
const { TENANT_COMPLAINT_FILTER } = require('../../services/tenantService');
const workflow = require('../../services/complaintWorkflowService');

exports.listReports = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
        const offset = (page - 1) * pageSize;
        const status = req.query.status || 'pending';

        const filter = TENANT_COMPLAINT_FILTER.trim();

        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM public.reports r
             INNER JOIN public.complaints c ON c.id::text = r.target_id
             WHERE r.target_type = 'complaint'
               AND r.status = $3
               AND ${filter}`,
            [req.tenant.id, req.tenant.cd_mun, status]
        );

        const { rows } = await pool.query(
            `SELECT
                r.id,
                r.target_type,
                r.target_id,
                r.reason,
                r.details,
                r.status,
                r.created_at,
                c.id AS complaint_id,
                COALESCE(cat.name, c.category) AS category_name,
                c.is_hidden,
                u.name AS reporter_name
             FROM public.reports r
             INNER JOIN public.complaints c ON c.id::text = r.target_id
             LEFT JOIN public.complaint_categories cat ON cat.id = c.category_id
             LEFT JOIN public.users u ON u.id = r.reporter_id
             WHERE r.target_type = 'complaint'
               AND r.status = $3
               AND ${filter}
             ORDER BY r.created_at DESC
             LIMIT $4 OFFSET $5`,
            [req.tenant.id, req.tenant.cd_mun, status, pageSize, offset]
        );

        const total = countResult.rows[0].total;

        res.status(200).json({
            items: rows.map((row) => ({
                id: row.id,
                targetType: row.target_type,
                targetId: row.target_id,
                complaintId: row.complaint_id,
                categoryName: row.category_name,
                reason: row.reason,
                details: row.details,
                status: row.status,
                isHidden: row.is_hidden,
                reporterName: row.reporter_name,
                createdAt: row.created_at,
            })),
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize) || 0,
            },
        });
    } catch (error) {
        console.error('Erro ao listar denúncias admin:', error);
        res.status(500).json({ message: 'Erro ao listar denúncias.' });
    }
};

exports.resolveReport = async (req, res) => {
    const { id } = req.params;
    const { action, note } = req.body ?? {};

    if (!['hide_complaint', 'dismiss'].includes(action)) {
        return res.status(400).json({ message: 'Ação inválida.' });
    }

    const client = await supabasePool.getPgPool().then((pool) => pool.connect());

    try {
        await client.query('BEGIN');

        const filter = TENANT_COMPLAINT_FILTER.trim();
        const { rows } = await client.query(
            `SELECT r.id, r.target_id, c.id AS complaint_id
             FROM public.reports r
             INNER JOIN public.complaints c ON c.id::text = r.target_id
             WHERE r.id = $3::uuid
               AND r.target_type = 'complaint'
               AND r.status = 'pending'
               AND ${filter}`,
            [req.tenant.id, req.tenant.cd_mun, id]
        );

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Denúncia não encontrada.' });
        }

        const report = rows[0];

        if (action === 'hide_complaint') {
            await client.query(
                `UPDATE public.complaints SET is_hidden = TRUE WHERE id = $1`,
                [report.complaint_id]
            );

            await client.query(
                `INSERT INTO public.complaint_events (
                    complaint_id, tenant_id, actor_id, event_type, payload, is_internal
                 ) VALUES ($1, $2, $3, 'moderation', $4::jsonb, true)`,
                [
                    report.complaint_id,
                    req.tenant.id,
                    req.user.id,
                    JSON.stringify({ action: 'hide_complaint', reportId: id, note: note ?? null }),
                ]
            );
        }

        await client.query(
            `UPDATE public.reports
             SET status = 'reviewed', reviewed_by = $1, reviewed_at = NOW()
             WHERE id = $2::uuid`,
            [req.user.id, id]
        );

        await client.query('COMMIT');

        res.status(200).json({ message: 'Denúncia tratada com sucesso.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erro ao resolver denúncia:', error);
        res.status(500).json({ message: 'Erro ao resolver denúncia.' });
    } finally {
        client.release();
    }
};

exports.pendingCount = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const filter = TENANT_COMPLAINT_FILTER.trim();
        const { rows } = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM public.reports r
             INNER JOIN public.complaints c ON c.id::text = r.target_id
             WHERE r.target_type = 'complaint'
               AND r.status = 'pending'
               AND ${filter}`,
            [req.tenant.id, req.tenant.cd_mun]
        );
        res.status(200).json({ count: rows[0].total });
    } catch (error) {
        console.error('Erro ao contar denúncias:', error);
        res.status(500).json({ message: 'Erro ao contar denúncias.' });
    }
};
