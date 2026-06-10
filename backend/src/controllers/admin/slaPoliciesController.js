const supabasePool = require('../../infra/supabasePool');
const { TENANT_COMPLAINT_FILTER } = require('../../services/tenantService');

exports.list = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(
            `SELECT
                pol.id,
                pol.category_id,
                cat.slug AS category_slug,
                cat.name AS category_name,
                pol.response_hours,
                pol.resolution_hours,
                pol.business_hours_only,
                pol.is_active
             FROM public.tenant_sla_policies pol
             JOIN public.complaint_categories cat ON cat.id = pol.category_id
             WHERE pol.tenant_id = $1::uuid
             ORDER BY cat.sort_order`,
            [req.tenant.id]
        );

        res.status(200).json({
            policies: rows.map((row) => ({
                id: row.id,
                categoryId: row.category_id,
                categorySlug: row.category_slug,
                categoryName: row.category_name,
                responseHours: row.response_hours,
                resolutionHours: row.resolution_hours,
                businessHoursOnly: row.business_hours_only,
                isActive: row.is_active,
            })),
        });
    } catch (error) {
        console.error('Erro ao listar políticas SLA:', error);
        res.status(500).json({ message: 'Erro ao listar políticas SLA.' });
    }
};

exports.upsertBatch = async (req, res) => {
    const { policies } = req.body ?? {};

    if (!Array.isArray(policies) || policies.length === 0) {
        return res.status(400).json({ message: 'Informe ao menos uma política.' });
    }

    const client = await supabasePool.getPgPool().then((pool) => pool.connect());

    try {
        await client.query('BEGIN');

        for (const policy of policies) {
            if (!policy.categoryId || !policy.responseHours || !policy.resolutionHours) {
                const err = new Error('Cada política exige categoryId, responseHours e resolutionHours.');
                err.statusCode = 400;
                throw err;
            }

            await client.query(
                `INSERT INTO public.tenant_sla_policies (
                    tenant_id, category_id, response_hours, resolution_hours, is_active
                 ) VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (tenant_id, category_id)
                 DO UPDATE SET
                    response_hours = EXCLUDED.response_hours,
                    resolution_hours = EXCLUDED.resolution_hours,
                    is_active = EXCLUDED.is_active`,
                [
                    req.tenant.id,
                    policy.categoryId,
                    policy.responseHours,
                    policy.resolutionHours,
                    policy.isActive !== false,
                ]
            );
        }

        await client.query(
            `UPDATE public.complaints c
             SET sla_due_at = c.created_at + (pol.resolution_hours || ' hours')::interval
             FROM public.tenant_sla_policies pol
             WHERE pol.tenant_id = $1::uuid
               AND pol.category_id = c.category_id
               AND pol.is_active = true
               AND COALESCE(c.status, 'pending') NOT IN ('resolved', 'closed', 'cancelled')
               AND ${TENANT_COMPLAINT_FILTER.trim()}`,
            [req.tenant.id, req.tenant.cd_mun]
        );

        await client.query('COMMIT');

        const pool = await supabasePool.getPgPool();
        const list = await pool.query(
            `SELECT pol.id, pol.category_id, cat.name AS category_name,
                    pol.response_hours, pol.resolution_hours, pol.is_active
             FROM public.tenant_sla_policies pol
             JOIN public.complaint_categories cat ON cat.id = pol.category_id
             WHERE pol.tenant_id = $1::uuid
             ORDER BY cat.sort_order`,
            [req.tenant.id]
        );

        res.status(200).json({
            message: 'Políticas SLA atualizadas.',
            policies: list.rows.map((row) => ({
                id: row.id,
                categoryId: row.category_id,
                categoryName: row.category_name,
                responseHours: row.response_hours,
                resolutionHours: row.resolution_hours,
                isActive: row.is_active,
            })),
        });
    } catch (error) {
        await client.query('ROLLBACK');
        const code = error.statusCode || 500;
        if (code >= 500) {
            console.error('Erro ao atualizar SLA:', error);
        }
        res.status(code).json({ message: error.message || 'Erro ao atualizar SLA.' });
    } finally {
        client.release();
    }
};
