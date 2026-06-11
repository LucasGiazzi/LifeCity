const PLATFORM_ROLE_RANK = {
    viewer: 0,
    operator: 1,
    admin: 2,
};

function requirePlatformRole(minRole) {
    const minRank = PLATFORM_ROLE_RANK[minRole];
    if (minRank === undefined) {
        throw new Error(`requirePlatformRole: papel inválido "${minRole}"`);
    }

    return (req, res, next) => {
        const role = req.platform?.role;
        const rank = PLATFORM_ROLE_RANK[role] ?? -1;

        if (rank < minRank) {
            return res.status(403).json({ message: 'Permissão insuficiente para esta operação.' });
        }

        next();
    };
}

module.exports = { requirePlatformRole, PLATFORM_ROLE_RANK };
