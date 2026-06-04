const supabasePool = require('../../infra/supabasePool');
const {
    getActiveTenantsForUser,
    getMembership,
    buildAccessToken,
} = require('../../services/tenantService');

exports.listMine = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        const tenants = await getActiveTenantsForUser(pool, req.user.id);
        res.status(200).json({ tenants });
    } catch (error) {
        console.error('Erro ao listar tenants:', error);
        res.status(500).json({ message: 'Erro ao listar municípios.' });
    }
};

exports.switchTenant = async (req, res) => {
    const { tenantId } = req.body ?? {};

    if (!tenantId) {
        return res.status(400).json({ message: 'tenantId é obrigatório.' });
    }

    try {
        const pool = await supabasePool.getPgPool();
        const membership = await getMembership(pool, req.user.id, tenantId);

        if (!membership) {
            return res.status(403).json({ message: 'Sem permissão para este município.' });
        }

        const accessToken = buildAccessToken(req.user.id, membership);

        res.status(200).json({
            message: 'Tenant alterado com sucesso.',
            accessToken,
            activeTenantId: membership.id,
        });
    } catch (error) {
        console.error('Erro ao trocar tenant:', error);
        res.status(500).json({ message: 'Erro ao trocar município.' });
    }
};
