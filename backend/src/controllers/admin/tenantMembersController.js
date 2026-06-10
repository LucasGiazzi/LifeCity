const supabasePool = require('../../infra/supabasePool');

exports.list = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(
            `SELECT
                tm.user_id,
                u.name,
                u.email,
                tm.role
             FROM public.tenant_members tm
             JOIN public.users u ON u.id = tm.user_id
             WHERE tm.tenant_id = $1::uuid AND tm.is_active = true
             ORDER BY u.name`,
            [req.tenant.id]
        );

        res.status(200).json({
            members: rows.map((row) => ({
                userId: row.user_id,
                name: row.name,
                email: row.email,
                role: row.role,
            })),
        });
    } catch (error) {
        console.error('Erro ao listar membros do tenant:', error);
        res.status(500).json({ message: 'Erro ao listar membros do município.' });
    }
};
