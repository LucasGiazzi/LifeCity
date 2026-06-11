const supabasePool = require('../../infra/supabasePool');

exports.list = async (req, res) => {
    const {
        tenantId,
        action,
        actorId,
        from,
        to,
        page = 1,
        pageSize = 50,
    } = req.query;

    const limit = Math.min(Math.max(parseInt(pageSize, 10) || 50, 1), 100);
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

    try {
        const pool = await supabasePool.getPgPool();
        const conditions = [];
        const params = [];
        let idx = 1;

        if (tenantId) {
            conditions.push(`al.tenant_id = $${idx++}`);
            params.push(tenantId);
        }
        if (action) {
            conditions.push(`al.action = $${idx++}`);
            params.push(action);
        }
        if (actorId) {
            conditions.push(`al.actor_id = $${idx++}`);
            params.push(actorId);
        }
        if (from) {
            conditions.push(`al.created_at >= $${idx++}`);
            params.push(from);
        }
        if (to) {
            conditions.push(`al.created_at <= $${idx++}`);
            params.push(to);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countResult = await pool.query(
            `SELECT COUNT(*)::int AS total FROM platform_audit_log al ${where}`,
            params
        );
        const total = countResult.rows[0]?.total ?? 0;

        const { rows } = await pool.query(
            `SELECT al.*,
                    u.name AS actor_name,
                    t.display_name AS tenant_name
             FROM platform_audit_log al
             JOIN users u ON u.id = al.actor_id
             LEFT JOIN tenants t ON t.id = al.tenant_id
             ${where}
             ORDER BY al.created_at DESC
             LIMIT $${idx++} OFFSET $${idx++}`,
            [...params, limit, offset]
        );

        res.status(200).json({
            items: rows.map((row) => ({
                id: row.id,
                actorId: row.actor_id,
                actorName: row.actor_name,
                action: row.action,
                targetType: row.target_type,
                targetId: row.target_id,
                tenantId: row.tenant_id,
                tenantName: row.tenant_name,
                payload: row.payload,
                createdAt: row.created_at,
            })),
            pagination: {
                page: Math.max(parseInt(page, 10) || 1, 1),
                pageSize: limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        console.error('Erro ao listar audit log:', error);
        res.status(500).json({ message: 'Erro ao listar audit log.' });
    }
};
