const supabasePool = require('../infra/supabasePool');

exports.list = async (_req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(
            `SELECT
                id,
                slug,
                name,
                short_name,
                color_hex,
                icon_key,
                description,
                sort_order
             FROM public.complaint_categories
             WHERE is_active = true
             ORDER BY sort_order, name`
        );

        res.status(200).json({
            categories: rows.map((row) => ({
                id: row.id,
                slug: row.slug,
                name: row.name,
                shortName: row.short_name,
                colorHex: row.color_hex,
                iconKey: row.icon_key,
                description: row.description,
                sortOrder: row.sort_order,
            })),
        });
    } catch (error) {
        console.error('Erro ao listar categorias:', error);
        res.status(500).json({ message: 'Erro ao listar categorias.' });
    }
};
