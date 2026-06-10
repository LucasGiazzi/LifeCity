const supabasePool = require('../../infra/supabasePool');
const { slugify } = require('../../services/opsRoutingService');

function mapTeam(row) {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        defaultCategoryIds: row.default_category_ids ?? [],
        defaultCdBairros: row.default_cd_bairros ?? [],
        contactEmail: row.contact_email,
        isActive: row.is_active,
        memberCount: row.member_count ?? 0,
    };
}

exports.list = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(
            `SELECT
                ot.id,
                ot.name,
                ot.slug,
                ot.description,
                ot.default_category_ids,
                ot.default_cd_bairros,
                ot.contact_email,
                ot.is_active,
                (
                    SELECT COUNT(*)::int
                    FROM public.ops_team_members otm
                    WHERE otm.ops_team_id = ot.id AND otm.is_active = true
                ) AS member_count
             FROM public.ops_teams ot
             WHERE ot.tenant_id = $1::uuid
             ORDER BY ot.is_active DESC, ot.name`,
            [req.tenant.id]
        );

        res.status(200).json({ teams: rows.map(mapTeam) });
    } catch (error) {
        console.error('Erro ao listar equipes operacionais:', error);
        res.status(500).json({ message: 'Erro ao listar equipes operacionais.' });
    }
};

exports.create = async (req, res) => {
    const {
        name,
        description,
        defaultCategoryIds = [],
        defaultCdBairros = [],
        contactEmail,
    } = req.body ?? {};

    if (!name || !String(name).trim()) {
        return res.status(400).json({ message: 'Nome da equipe é obrigatório.' });
    }

    const baseSlug = slugify(name);
    const pool = await supabasePool.getPgPool();

    try {
        let slug = baseSlug;
        let suffix = 1;
        while (true) {
            const { rows } = await pool.query(
                `SELECT 1 FROM public.ops_teams
                 WHERE tenant_id = $1::uuid AND slug = $2 LIMIT 1`,
                [req.tenant.id, slug]
            );
            if (rows.length === 0) {
                break;
            }
            slug = `${baseSlug}-${suffix}`;
            suffix += 1;
        }

        const { rows } = await pool.query(
            `INSERT INTO public.ops_teams (
                tenant_id, name, slug, description,
                default_category_ids, default_cd_bairros, contact_email
             ) VALUES ($1, $2, $3, $4, $5::uuid[], $6::varchar[], $7)
             RETURNING id, name, slug, description, default_category_ids,
                       default_cd_bairros, contact_email, is_active`,
            [
                req.tenant.id,
                String(name).trim(),
                slug,
                description ?? null,
                defaultCategoryIds,
                defaultCdBairros,
                contactEmail ?? null,
            ]
        );

        res.status(201).json({ team: mapTeam({ ...rows[0], member_count: 0 }) });
    } catch (error) {
        console.error('Erro ao criar equipe operacional:', error);
        res.status(500).json({ message: 'Erro ao criar equipe operacional.' });
    }
};

exports.update = async (req, res) => {
    const { id } = req.params;
    const {
        name,
        description,
        defaultCategoryIds,
        defaultCdBairros,
        contactEmail,
        isActive,
    } = req.body ?? {};

    const pool = await supabasePool.getPgPool();

    try {
        const { rows: existing } = await pool.query(
            `SELECT id FROM public.ops_teams
             WHERE id = $1::uuid AND tenant_id = $2::uuid`,
            [id, req.tenant.id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Equipe não encontrada.' });
        }

        const { rows } = await pool.query(
            `UPDATE public.ops_teams
             SET name = COALESCE($3, name),
                 description = COALESCE($4, description),
                 default_category_ids = COALESCE($5::uuid[], default_category_ids),
                 default_cd_bairros = COALESCE($6::varchar[], default_cd_bairros),
                 contact_email = COALESCE($7, contact_email),
                 is_active = COALESCE($8, is_active)
             WHERE id = $1::uuid AND tenant_id = $2::uuid
             RETURNING id, name, slug, description, default_category_ids,
                       default_cd_bairros, contact_email, is_active`,
            [
                id,
                req.tenant.id,
                name ? String(name).trim() : null,
                description !== undefined ? description : null,
                defaultCategoryIds !== undefined ? defaultCategoryIds : null,
                defaultCdBairros !== undefined ? defaultCdBairros : null,
                contactEmail !== undefined ? contactEmail : null,
                isActive !== undefined ? Boolean(isActive) : null,
            ]
        );

        const { rows: countRows } = await pool.query(
            `SELECT COUNT(*)::int AS member_count
             FROM public.ops_team_members
             WHERE ops_team_id = $1::uuid AND is_active = true`,
            [id]
        );

        res.status(200).json({
            team: mapTeam({ ...rows[0], member_count: countRows[0].member_count }),
        });
    } catch (error) {
        console.error('Erro ao atualizar equipe operacional:', error);
        res.status(500).json({ message: 'Erro ao atualizar equipe operacional.' });
    }
};

exports.listMembers = async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await supabasePool.getPgPool();

        const { rows: teamRows } = await pool.query(
            `SELECT id FROM public.ops_teams
             WHERE id = $1::uuid AND tenant_id = $2::uuid`,
            [id, req.tenant.id]
        );

        if (teamRows.length === 0) {
            return res.status(404).json({ message: 'Equipe não encontrada.' });
        }

        const { rows } = await pool.query(
            `SELECT
                otm.user_id,
                otm.role,
                otm.is_active,
                otm.joined_at,
                u.name,
                u.email
             FROM public.ops_team_members otm
             JOIN public.users u ON u.id = otm.user_id
             WHERE otm.ops_team_id = $1::uuid AND otm.is_active = true
             ORDER BY u.name`,
            [id]
        );

        res.status(200).json({
            members: rows.map((row) => ({
                userId: row.user_id,
                name: row.name,
                email: row.email,
                role: row.role,
                joinedAt: row.joined_at,
            })),
        });
    } catch (error) {
        console.error('Erro ao listar membros da equipe:', error);
        res.status(500).json({ message: 'Erro ao listar membros da equipe.' });
    }
};

exports.addMember = async (req, res) => {
    const { id } = req.params;
    const { userId, role = 'member' } = req.body ?? {};

    if (!userId) {
        return res.status(400).json({ message: 'userId é obrigatório.' });
    }

    if (!['lead', 'member'].includes(role)) {
        return res.status(400).json({ message: 'Papel inválido.' });
    }

    const pool = await supabasePool.getPgPool();

    try {
        const { rows: teamRows } = await pool.query(
            `SELECT id FROM public.ops_teams
             WHERE id = $1::uuid AND tenant_id = $2::uuid AND is_active = true`,
            [id, req.tenant.id]
        );

        if (teamRows.length === 0) {
            return res.status(404).json({ message: 'Equipe não encontrada.' });
        }

        const { rows: memberRows } = await pool.query(
            `SELECT user_id FROM public.tenant_members
             WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND is_active = true`,
            [req.tenant.id, userId]
        );

        if (memberRows.length === 0) {
            return res.status(400).json({ message: 'Utilizador deve ser membro do município.' });
        }

        await pool.query(
            `INSERT INTO public.ops_team_members (ops_team_id, user_id, role)
             VALUES ($1, $2, $3)
             ON CONFLICT (ops_team_id, user_id)
             DO UPDATE SET role = EXCLUDED.role, is_active = true`,
            [id, userId, role]
        );

        res.status(201).json({ message: 'Membro adicionado.' });
    } catch (error) {
        console.error('Erro ao adicionar membro à equipe:', error);
        res.status(500).json({ message: 'Erro ao adicionar membro à equipe.' });
    }
};

exports.removeMember = async (req, res) => {
    const { id, userId } = req.params;

    try {
        const pool = await supabasePool.getPgPool();

        const { rowCount } = await pool.query(
            `UPDATE public.ops_team_members otm
             SET is_active = false
             FROM public.ops_teams ot
             WHERE otm.ops_team_id = ot.id
               AND ot.id = $1::uuid
               AND ot.tenant_id = $2::uuid
               AND otm.user_id = $3::uuid
               AND otm.is_active = true`,
            [id, req.tenant.id, userId]
        );

        if (rowCount === 0) {
            return res.status(404).json({ message: 'Membro não encontrado.' });
        }

        res.status(200).json({ message: 'Membro removido.' });
    } catch (error) {
        console.error('Erro ao remover membro da equipe:', error);
        res.status(500).json({ message: 'Erro ao remover membro da equipe.' });
    }
};
