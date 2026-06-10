const ROLE_RANK = {
    viewer: 0,
    operator: 1,
    admin: 2,
    owner: 3,
};

function requireTenantRole(minRole) {
    const minRank = ROLE_RANK[minRole];
    if (minRank === undefined) {
        throw new Error(`requireTenantRole: papel inválido "${minRole}"`);
    }

    return (req, res, next) => {
        const role = req.tenant?.role;
        const rank = ROLE_RANK[role] ?? -1;

        if (rank < minRank) {
            return res.status(403).json({ message: 'Permissão insuficiente para esta operação.' });
        }

        next();
    };
}

module.exports = { requireTenantRole, ROLE_RANK };
