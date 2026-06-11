const supabasePool = require('../../infra/supabasePool');
const { getPlatformMembership } = require('../../services/platformService');

const VALID_PLATFORM_ROLES = ['viewer', 'operator', 'admin'];

exports.list = async (_req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(
            `SELECT pu.user_id, pu.role, pu.is_active, pu.created_at,
                    u.name, u.email
             FROM platform_users pu
             JOIN users u ON u.id = pu.user_id
             ORDER BY u.name`
        );

        res.status(200).json({
            staff: rows.map((row) => ({
                userId: row.user_id,
                name: row.name,
                email: row.email,
                role: row.role,
                isActive: row.is_active,
                createdAt: row.created_at,
            })),
        });
    } catch (error) {
        console.error('Erro ao listar staff:', error);
        res.status(500).json({ message: 'Erro ao listar staff platform.' });
    }
};

exports.create = async (req, res) => {
    const { email, role = 'operator' } = req.body ?? {};

    if (!email) {
        return res.status(400).json({ message: 'E-mail é obrigatório.' });
    }
    if (!VALID_PLATFORM_ROLES.includes(role)) {
        return res.status(400).json({ message: 'Role platform inválida.' });
    }

    try {
        const pool = await supabasePool.getPgPool();
        const normalizedEmail = email.toLowerCase().trim();

        const { rows: users } = await pool.query(
            'SELECT id FROM users WHERE LOWER(email) = $1',
            [normalizedEmail]
        );
        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado. Cadastre-o primeiro.' });
        }

        const userId = users[0].id;
        const { rows } = await pool.query(
            `INSERT INTO platform_users (user_id, role, is_active)
             VALUES ($1, $2, true)
             ON CONFLICT (user_id) DO UPDATE SET role = $2, is_active = true
             RETURNING user_id, role, is_active`,
            [userId, role]
        );

        res.status(201).json({
            staff: {
                userId: rows[0].user_id,
                role: rows[0].role,
                isActive: rows[0].is_active,
            },
        });
    } catch (error) {
        console.error('Erro ao criar staff:', error);
        res.status(500).json({ message: 'Erro ao vincular staff platform.' });
    }
};

exports.patch = async (req, res) => {
    const { userId } = req.params;
    const { role, isActive } = req.body ?? {};

    if (role === undefined && isActive === undefined) {
        return res.status(400).json({ message: 'Informe role ou isActive.' });
    }

    try {
        const pool = await supabasePool.getPgPool();
        const existing = await getPlatformMembership(pool, userId);
        if (!existing) {
            return res.status(404).json({ message: 'Staff não encontrado.' });
        }

        const updates = [];
        const params = [];
        let idx = 1;

        if (role !== undefined) {
            if (!VALID_PLATFORM_ROLES.includes(role)) {
                return res.status(400).json({ message: 'Role platform inválida.' });
            }
            updates.push(`role = $${idx++}`);
            params.push(role);
        }
        if (isActive !== undefined) {
            updates.push(`is_active = $${idx++}`);
            params.push(Boolean(isActive));
        }

        params.push(userId);
        const { rows } = await pool.query(
            `UPDATE platform_users SET ${updates.join(', ')} WHERE user_id = $${idx}
             RETURNING user_id, role, is_active`,
            params
        );

        res.status(200).json({
            staff: {
                userId: rows[0].user_id,
                role: rows[0].role,
                isActive: rows[0].is_active,
            },
        });
    } catch (error) {
        console.error('Erro ao atualizar staff:', error);
        res.status(500).json({ message: 'Erro ao atualizar staff platform.' });
    }
};
