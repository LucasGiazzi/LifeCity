const supabasePool = require('../infra/supabasePool');
const { getMembership } = require('../services/tenantService');

async function requireTenantMember(req, res, next) {
    const { id: userId, tenantId, cd_mun, tenantRole } = req.user ?? {};

    if (!tenantId || !cd_mun || !tenantRole) {
        return res.status(403).json({
            message: 'Acesso administrativo requer vínculo ativo com um município.',
        });
    }

    try {
        const pool = await supabasePool.getPgPool();
        const membership = await getMembership(pool, userId, tenantId);

        if (!membership || membership.cd_mun !== cd_mun || membership.role !== tenantRole) {
            return res.status(403).json({
                message: 'Membership municipal inválida ou expirada.',
            });
        }

        req.tenant = {
            id: tenantId,
            cd_mun: membership.cd_mun,
            role: membership.role,
        };
        next();
    } catch (error) {
        console.error('Erro ao validar tenant membership:', error);
        res.status(500).json({ message: 'Erro ao validar acesso administrativo.' });
    }
}

module.exports = { requireTenantMember };
