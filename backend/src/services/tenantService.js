const jwt = require('jsonwebtoken');

async function getActiveTenantsForUser(pool, userId) {
    const { rows } = await pool.query(
        `SELECT t.id, t.slug, t.display_name, t.cd_mun, tm.role
         FROM tenant_members tm
         JOIN tenants t ON t.id = tm.tenant_id
         WHERE tm.user_id = $1 AND tm.is_active = true
         ORDER BY t.display_name`,
        [userId]
    );

    return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        displayName: row.display_name,
        cd_mun: row.cd_mun,
        role: row.role,
    }));
}

async function getMembership(pool, userId, tenantId) {
    const { rows } = await pool.query(
        `SELECT t.id, t.cd_mun, tm.role
         FROM tenant_members tm
         JOIN tenants t ON t.id = tm.tenant_id
         WHERE tm.user_id = $1 AND tm.tenant_id = $2 AND tm.is_active = true`,
        [userId, tenantId]
    );
    return rows[0] ?? null;
}

function buildAccessToken(userId, options = {}) {
    const tenant = options.tenant ?? (options.id ? options : null);
    const platformRole = options.platformRole ?? null;
    const impersonating = options.impersonating ?? false;

    const payload = {
        userId,
        impersonating: Boolean(impersonating),
    };

    if (platformRole) {
        payload.platformRole = platformRole;
    }

    if (tenant) {
        payload.tenantId = tenant.id;
        payload.cd_mun = tenant.cd_mun;
        payload.tenantRole = tenant.role;
    }

    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
}

function buildRefreshToken(userId, options = {}) {
    const tenantId = typeof options === 'string' || options === null
        ? options
        : (options.tenantId ?? null);
    const impersonating = typeof options === 'object' && options !== null
        ? (options.impersonating ?? false)
        : false;

    const payload = {
        userId,
        impersonating: Boolean(impersonating),
    };

    if (tenantId) {
        payload.tenantId = tenantId;
    }

    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

const TENANT_COMPLAINT_FILTER = `
    (
        c.tenant_id = $1::uuid
        OR (c.tenant_id IS NULL AND c.cd_mun = $2::char(7))
        OR (
            c.tenant_id IS NULL
            AND c.cd_mun IS NULL
            AND geo.resolve_cd_mun(c.location) = $2::char(7)
        )
    )
`;

module.exports = {
    getActiveTenantsForUser,
    getMembership,
    buildAccessToken,
    buildRefreshToken,
    TENANT_COMPLAINT_FILTER,
};
