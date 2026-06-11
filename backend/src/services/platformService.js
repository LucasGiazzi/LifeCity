async function getPlatformMembership(pool, userId) {
    const { rows } = await pool.query(
        `SELECT id, user_id, role, is_active
         FROM platform_users
         WHERE user_id = $1 AND is_active = true`,
        [userId]
    );
    return rows[0] ?? null;
}

async function writeAuditLog(pool, {
    actorId,
    action,
    targetType,
    targetId,
    tenantId = null,
    payload = {},
}) {
    await pool.query(
        `INSERT INTO platform_audit_log (actor_id, action, target_type, target_id, tenant_id, payload)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [actorId, action, targetType, targetId, tenantId, JSON.stringify(payload)]
    );
}

module.exports = {
    getPlatformMembership,
    writeAuditLog,
};
