const supabasePool = require('../../infra/supabasePool');

function complaintScopeSql(alias) {
    return `(${alias}.tenant_id = $1::uuid OR (${alias}.tenant_id IS NULL AND ${alias}.cd_mun = $2::char(7)))`;
}

exports.list = async (req, res) => {
    const { id } = req.params;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), 100);
    const offset = (page - 1) * pageSize;
    const q = req.query.q?.trim();

    try {
        const pool = await supabasePool.getPgPool();
        const { rows: tenantRows } = await pool.query(
            'SELECT id, cd_mun FROM tenants WHERE id = $1',
            [id]
        );
        if (tenantRows.length === 0) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }

        const cd_mun = tenantRows[0].cd_mun?.trim?.() ?? tenantRows[0].cd_mun;

        const conditions = [
            `(u.home_cd_mun = $2 OR EXISTS (
                SELECT 1 FROM complaints cx
                WHERE cx.created_by = u.id AND ${complaintScopeSql('cx')}
            ))`,
        ];
        const params = [id, cd_mun];
        let idx = 3;

        if (q) {
            conditions.push(`(u.name ILIKE $${idx} OR u.email ILIKE $${idx})`);
            params.push(`%${q}%`);
            idx++;
        }

        const where = conditions.join(' AND ');

        const countResult = await pool.query(
            `SELECT COUNT(DISTINCT u.id)::int AS total
             FROM users u
             WHERE ${where}`,
            params
        );
        const total = countResult.rows[0]?.total ?? 0;

        const { rows } = await pool.query(
            `SELECT
                u.id AS user_id,
                u.name,
                u.email,
                u.photo_url,
                u.home_cd_mun,
                u.address_confirmed_at,
                u.created_at AS registered_at,
                COUNT(c.id)::int AS complaint_count,
                COUNT(c.id) FILTER (
                    WHERE COALESCE(c.status, 'pending') IN ('resolved', 'closed')
                )::int AS resolved_complaint_count,
                MAX(c.created_at) AS last_complaint_at
             FROM users u
             LEFT JOIN complaints c
                ON c.created_by = u.id AND ${complaintScopeSql('c')}
             WHERE ${where}
             GROUP BY u.id
             ORDER BY complaint_count DESC, u.name ASC
             LIMIT $${idx++} OFFSET $${idx++}`,
            [...params, pageSize, offset]
        );

        res.status(200).json({
            items: rows.map((row) => ({
                userId: row.user_id,
                name: row.name,
                email: row.email,
                photoUrl: row.photo_url,
                homeCdMun: row.home_cd_mun?.trim?.() ?? row.home_cd_mun,
                addressConfirmedAt: row.address_confirmed_at,
                registeredAt: row.registered_at,
                complaintCount: row.complaint_count,
                resolvedComplaintCount: row.resolved_complaint_count,
                lastComplaintAt: row.last_complaint_at,
                isResident: row.home_cd_mun?.trim() === cd_mun,
            })),
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize) || 1,
            },
        });
    } catch (error) {
        console.error('Erro ao listar cidadãos do tenant:', error);
        res.status(500).json({ message: 'Erro ao listar cidadãos.' });
    }
};
