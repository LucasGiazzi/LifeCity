const supabasePool = require('../infra/supabasePool');
const { getMembership } = require('../services/tenantService');
const { getPlatformMembership } = require('../services/platformService');

async function requireTenantMember(req, res, next) {
    const {
        id: userId,
        tenantId,
        cd_mun,
        tenantRole,
        impersonating,
        platformRole,
    } = req.user ?? {};

    if (!tenantId || !cd_mun || !tenantRole) {
        return res.status(403).json({
            message: 'Acesso administrativo requer vínculo ativo com um município.',
        });
    }

    try {
        const pool = await supabasePool.getPgPool();
        const { rows: tenantRows } = await pool.query(
            'SELECT id, cd_mun, status FROM tenants WHERE id = $1',
            [tenantId]
        );

        if (tenantRows.length === 0) {
            return res.status(403).json({ message: 'Município não encontrado.' });
        }

        const tenant = tenantRows[0];
        const tenantCdMun = tenant.cd_mun?.trim?.() ?? tenant.cd_mun;

        if (tenant.status === 'suspended' && !impersonating) {
            return res.status(403).json({ message: 'Município suspenso.' });
        }

        if (impersonating) {
            if (!platformRole) {
                return res.status(403).json({ message: 'Impersonation inválida.' });
            }
            const platformMembership = await getPlatformMembership(pool, userId);
            if (!platformMembership) {
                return res.status(403).json({ message: 'Staff platform inválido ou inativo.' });
            }
            req.tenant = {
                id: tenantId,
                cd_mun: tenantCdMun,
                role: tenantRole,
            };
            return next();
        }

        const membership = await getMembership(pool, userId, tenantId);
        const memberCdMun = membership?.cd_mun?.trim?.() ?? membership?.cd_mun;

        if (!membership || memberCdMun !== String(cd_mun).trim() || membership.role !== tenantRole) {
            return res.status(403).json({
                message: 'Membership municipal inválida ou expirada.',
            });
        }

        req.tenant = {
            id: tenantId,
            cd_mun: memberCdMun,
            role: membership.role,
        };
        next();
    } catch (error) {
        console.error('Erro ao validar tenant membership:', error);
        res.status(500).json({ message: 'Erro ao validar acesso administrativo.' });
    }
}

module.exports = { requireTenantMember };
