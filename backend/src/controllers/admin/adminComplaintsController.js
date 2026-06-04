const supabasePool = require('../../infra/supabasePool');
const { listBlobs } = require('../../infra/supabaseStorageClient');
const { TENANT_COMPLAINT_FILTER } = require('../../services/tenantService');

function buildComplaintFilters(query, tenantId, cdMun, params) {
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
    u.name AS reporter_name,
    u.email AS reporter_email,
    u.phone AS reporter_phone
`;

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
            complaint: rows[0],
            photos,
        });
    } catch (error) {
        console.error('Erro ao buscar ocorrência admin:', error);
        res.status(500).json({ message: 'Erro ao buscar ocorrência.' });
    }
};
