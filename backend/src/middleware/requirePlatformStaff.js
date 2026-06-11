const supabasePool = require('../infra/supabasePool');
const { getPlatformMembership } = require('../services/platformService');

async function requirePlatformStaff(req, res, next) {
    const platformRole = req.user?.platformRole;

    if (!platformRole) {
        return res.status(403).json({ message: 'Acesso restrito a staff LifeCity.' });
    }

    try {
        const pool = await supabasePool.getPgPool();
        const membership = await getPlatformMembership(pool, req.user.id);

        if (!membership || membership.role !== platformRole) {
            return res.status(403).json({ message: 'Membership platform inválida ou expirada.' });
        }

        req.platform = { role: membership.role };
        next();
    } catch (error) {
        console.error('Erro ao validar platform staff:', error);
        res.status(500).json({ message: 'Erro ao validar acesso platform.' });
    }
}

module.exports = { requirePlatformStaff };
