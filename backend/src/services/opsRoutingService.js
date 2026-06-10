async function resolveAutoOpsTeam(pool, tenantId, categoryId, cdBairro) {
    if (categoryId) {
        const { rows } = await pool.query(
            `SELECT id FROM public.ops_teams
             WHERE tenant_id = $1::uuid
               AND is_active = true
               AND $2::uuid = ANY(default_category_ids)
             ORDER BY created_at
             LIMIT 1`,
            [tenantId, categoryId]
        );
        if (rows[0]) {
            return rows[0].id;
        }
    }

    if (cdBairro) {
        const { rows } = await pool.query(
            `SELECT id FROM public.ops_teams
             WHERE tenant_id = $1::uuid
               AND is_active = true
               AND $2 = ANY(default_cd_bairros)
             ORDER BY created_at
             LIMIT 1`,
            [tenantId, cdBairro]
        );
        if (rows[0]) {
            return rows[0].id;
        }
    }

    const { rows } = await pool.query(
        `SELECT id FROM public.ops_teams
         WHERE tenant_id = $1::uuid AND slug = 'triagem-geral' AND is_active = true
         LIMIT 1`,
        [tenantId]
    );

    return rows[0]?.id ?? null;
}

function slugify(value) {
    return String(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'equipe';
}

module.exports = { resolveAutoOpsTeam, slugify };
