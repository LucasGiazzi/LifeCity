const supabasePool = require('../../infra/supabasePool');
const { writeAuditLog } = require('../../services/platformService');
const { buildAccessToken, buildRefreshToken } = require('../../services/tenantService');

exports.enter = async (req, res) => {
    const { id: tenantId } = req.params;

    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(
            'SELECT id, slug, display_name, cd_mun FROM tenants WHERE id = $1',
            [tenantId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }

        const tenant = rows[0];
        const cd_mun = tenant.cd_mun?.trim?.() ?? tenant.cd_mun;

        try {
            await writeAuditLog(pool, {
                actorId: req.user.id,
                action: 'impersonation.start',
                targetType: 'tenant',
                targetId: tenantId,
                tenantId,
                payload: { slug: tenant.slug },
            });
        } catch (auditErr) {
            console.error('Falha ao registrar audit de impersonation:', auditErr);
            return res.status(500).json({ message: 'Falha ao registrar auditoria.' });
        }

        const accessToken = buildAccessToken(req.user.id, {
            tenant: { id: tenant.id, cd_mun, role: 'admin' },
            platformRole: req.platform.role,
            impersonating: true,
        });
        const refreshToken = buildRefreshToken(req.user.id, {
            tenantId: tenant.id,
            impersonating: true,
        });

        res.status(200).json({
            accessToken,
            refreshToken,
            tenant: {
                id: tenant.id,
                slug: tenant.slug,
                displayName: tenant.display_name,
                cd_mun,
                role: 'admin',
            },
            impersonating: true,
        });
    } catch (error) {
        console.error('Erro ao entrar em impersonation:', error);
        res.status(500).json({ message: 'Erro ao entrar no município.' });
    }
};

exports.exit = async (req, res) => {
    if (!req.user.impersonating) {
        return res.status(400).json({ message: 'Não está em modo impersonation.' });
    }

    const tenantId = req.user.tenantId;

    try {
        const pool = await supabasePool.getPgPool();

        try {
            await writeAuditLog(pool, {
                actorId: req.user.id,
                action: 'impersonation.end',
                targetType: 'tenant',
                targetId: tenantId,
                tenantId,
                payload: {},
            });
        } catch (auditErr) {
            console.error('Falha ao registrar audit de impersonation:', auditErr);
            return res.status(500).json({ message: 'Falha ao registrar auditoria.' });
        }

        const accessToken = buildAccessToken(req.user.id, {
            platformRole: req.platform.role,
            impersonating: false,
        });
        const refreshToken = buildRefreshToken(req.user.id, { impersonating: false });

        res.status(200).json({
            accessToken,
            refreshToken,
            impersonating: false,
        });
    } catch (error) {
        console.error('Erro ao sair de impersonation:', error);
        res.status(500).json({ message: 'Erro ao sair do município.' });
    }
};
