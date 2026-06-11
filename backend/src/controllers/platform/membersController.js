const supabasePool = require('../../infra/supabasePool');
const { writeAuditLog } = require('../../services/platformService');
const { inviteMember, listPendingInvitations, VALID_ROLES } = require('../../services/tenantInvitationService');

exports.list = async (req, res) => {
    const { id: tenantId } = req.params;

    try {
        const pool = await supabasePool.getPgPool();
        const { rows: tenantRows } = await pool.query('SELECT id FROM tenants WHERE id = $1', [tenantId]);
        if (tenantRows.length === 0) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }

        const { rows } = await pool.query(
            `SELECT tm.user_id, tm.role, tm.is_active, tm.created_at AS joined_at,
                    u.name, u.email
             FROM tenant_members tm
             JOIN users u ON u.id = tm.user_id
             WHERE tm.tenant_id = $1
             ORDER BY tm.created_at`,
            [tenantId]
        );

        const pendingInvitations = await listPendingInvitations(pool, tenantId);

        res.status(200).json({
            members: rows.map((row) => ({
                userId: row.user_id,
                name: row.name,
                email: row.email,
                role: row.role,
                isActive: row.is_active,
                joinedAt: row.joined_at,
            })),
            pendingInvitations,
        });
    } catch (error) {
        console.error('Erro ao listar membros:', error);
        res.status(500).json({ message: 'Erro ao listar membros municipais.' });
    }
};

exports.invite = async (req, res) => {
    const { id: tenantId } = req.params;
    const { email, role = 'admin', name } = req.body ?? {};

    if (!email) {
        return res.status(400).json({ message: 'E-mail é obrigatório.' });
    }
    if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ message: 'Role municipal inválida.' });
    }

    try {
        const pool = await supabasePool.getPgPool();
        const result = await inviteMember(pool, {
            tenantId,
            email,
            role,
            name,
            invitedBy: req.user.id,
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Erro ao convidar membro:', error);
        res.status(error.status || 500).json({ message: error.message || 'Erro ao convidar membro.' });
    }
};

exports.patch = async (req, res) => {
    const { id: tenantId, userId } = req.params;
    const { role, isActive } = req.body ?? {};

    if (role === undefined && isActive === undefined) {
        return res.status(400).json({ message: 'Informe role ou isActive.' });
    }

    if (req.user.impersonating && userId === req.user.id) {
        return res.status(403).json({ message: 'Não é permitido alterar a si mesmo em impersonation.' });
    }

    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(
            'SELECT * FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
            [tenantId, userId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Membro não encontrado.' });
        }

        const updates = [];
        const params = [];
        let idx = 1;
        let auditAction = 'member.role_change';

        if (role !== undefined) {
            if (!VALID_ROLES.includes(role)) {
                return res.status(400).json({ message: 'Role municipal inválida.' });
            }
            updates.push(`role = $${idx++}`);
            params.push(role);
        }

        if (isActive !== undefined) {
            updates.push(`is_active = $${idx++}`);
            params.push(Boolean(isActive));
            if (!isActive) auditAction = 'member.deactivate';
        }

        params.push(tenantId, userId);
        await pool.query(
            `UPDATE tenant_members SET ${updates.join(', ')}
             WHERE tenant_id = $${idx++} AND user_id = $${idx}`,
            params
        );

        await writeAuditLog(pool, {
            actorId: req.user.id,
            action: auditAction,
            targetType: 'tenant_member',
            targetId: userId,
            tenantId,
            payload: { role, isActive },
        });

        res.status(200).json({ message: 'Membro atualizado.' });
    } catch (error) {
        console.error('Erro ao atualizar membro:', error);
        res.status(500).json({ message: 'Erro ao atualizar membro.' });
    }
};
