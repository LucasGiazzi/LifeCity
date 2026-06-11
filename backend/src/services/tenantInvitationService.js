const crypto = require('crypto');
const { encryptPassword, generateSalt } = require('../infra/crypto');
const { sendTenantInviteEmail } = require('../infra/mailer');
const { writeAuditLog } = require('./platformService');
const {
    getActiveTenantsForUser,
    buildAccessToken,
    buildRefreshToken,
} = require('./tenantService');

const ADMIN_WEB_BASE_URL = process.env.ADMIN_WEB_BASE_URL || 'http://localhost:5173';
const VALID_ROLES = ['owner', 'admin', 'operator', 'viewer'];

function generateInviteToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    return { token, tokenHash };
}

function buildSetupLink(token) {
    return `${ADMIN_WEB_BASE_URL}/accept-invite?token=${token}`;
}

function deriveNameFromEmail(email, name) {
    if (name?.trim()) return name.trim();
    return email.split('@')[0];
}

async function trySendInviteEmail(email, setupLink, tenantDisplayName) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return false;
    }
    try {
        await sendTenantInviteEmail(email, setupLink, tenantDisplayName);
        return true;
    } catch (err) {
        console.warn('[tenantInvitation] Falha ao enviar e-mail:', err.message);
        return false;
    }
}

async function inviteMemberInTransaction(client, {
    tenantId,
    tenantDisplayName,
    email,
    role = 'admin',
    name,
    invitedBy,
}) {
    const normalizedEmail = email.toLowerCase().trim();
    const { rows: existingUsers } = await client.query(
        'SELECT id, email FROM users WHERE LOWER(email) = $1',
        [normalizedEmail]
    );

    if (existingUsers.length > 0) {
        const user = existingUsers[0];
        const { rows: existingMember } = await client.query(
            'SELECT id FROM tenant_members WHERE tenant_id = $1 AND user_id = $2 AND is_active',
            [tenantId, user.id]
        );
        if (existingMember.length > 0) {
            const err = new Error('Usuário já é membro ativo deste município.');
            err.status = 409;
            throw err;
        }
        await client.query(
            `INSERT INTO tenant_members (tenant_id, user_id, role, is_active) VALUES ($1, $2, $3, true)
             ON CONFLICT (tenant_id, user_id) DO UPDATE SET is_active = true, role = $3`,
            [tenantId, user.id, role]
        );
        await writeAuditLog(client, {
            actorId: invitedBy,
            action: 'member.invite',
            targetType: 'tenant_member',
            targetId: user.id,
            tenantId,
            payload: { email: normalizedEmail, role, accountCreated: false },
        });
        return null;
    }

    const randomPassword = crypto.randomBytes(32).toString('hex');
    const salt = generateSalt();
    const hashedPassword = encryptPassword(randomPassword, salt);
    const displayName = deriveNameFromEmail(normalizedEmail, name);
    const { token, tokenHash } = generateInviteToken();

    const { rows: userRows } = await client.query(
        `INSERT INTO users (email, password, name, salt, user_level)
         VALUES ($1, $2, $3, $4, 2)
         RETURNING id`,
        [normalizedEmail, hashedPassword, displayName, salt]
    );

    await client.query(
        'INSERT INTO tenant_members (tenant_id, user_id, role, is_active) VALUES ($1, $2, $3, true)',
        [tenantId, userRows[0].id, role]
    );

    const { rows: invRows } = await client.query(
        `INSERT INTO tenant_invitations (tenant_id, user_id, email, role, token_hash, invited_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '7 days')
         RETURNING id, email, role, expires_at`,
        [tenantId, userRows[0].id, normalizedEmail, role, tokenHash, invitedBy]
    );

    await writeAuditLog(client, {
        actorId: invitedBy,
        action: 'member.invite',
        targetType: 'tenant_invitation',
        targetId: invRows[0].id,
        tenantId,
        payload: { email: normalizedEmail, role, accountCreated: true },
    });

    const setupLink = buildSetupLink(token);
    const emailSent = await trySendInviteEmail(normalizedEmail, setupLink, tenantDisplayName);

    return {
        id: invRows[0].id,
        email: invRows[0].email,
        role: invRows[0].role,
        expiresAt: invRows[0].expires_at,
        setupLink,
        emailSent,
        accountCreated: true,
    };
}

async function inviteMember(pool, {
    tenantId,
    email,
    role = 'admin',
    name,
    invitedBy,
}) {
    const normalizedEmail = email.toLowerCase().trim();
    if (!VALID_ROLES.includes(role)) {
        const err = new Error('Role municipal inválida.');
        err.status = 400;
        throw err;
    }

    const { rows: tenantRows } = await pool.query(
        'SELECT id, display_name FROM tenants WHERE id = $1',
        [tenantId]
    );
    if (tenantRows.length === 0) {
        const err = new Error('Tenant não encontrado.');
        err.status = 404;
        throw err;
    }
    const tenantDisplayName = tenantRows[0].display_name;

    const { rows: existingUsers } = await pool.query(
        'SELECT id, email, name FROM users WHERE LOWER(email) = $1',
        [normalizedEmail]
    );

    if (existingUsers.length > 0) {
        const user = existingUsers[0];

        const { rows: existingMember } = await pool.query(
            'SELECT id, is_active FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
            [tenantId, user.id]
        );
        if (existingMember.length > 0 && existingMember[0].is_active) {
            const err = new Error('Usuário já é membro ativo deste município.');
            err.status = 409;
            throw err;
        }

        if (existingMember.length > 0) {
            await pool.query(
                'UPDATE tenant_members SET is_active = true, role = $1 WHERE tenant_id = $2 AND user_id = $3',
                [role, tenantId, user.id]
            );
        } else {
            await pool.query(
                'INSERT INTO tenant_members (tenant_id, user_id, role, is_active) VALUES ($1, $2, $3, true)',
                [tenantId, user.id, role]
            );
        }

        await writeAuditLog(pool, {
            actorId: invitedBy,
            action: 'member.invite',
            targetType: 'tenant_member',
            targetId: user.id,
            tenantId,
            payload: { email: normalizedEmail, role, accountCreated: false },
        });

        return {
            memberAdded: true,
            userId: user.id,
            email: user.email,
            role,
            setupLink: null,
            message: 'Usuário já existia — membro adicionado. Informe para fazer login.',
        };
    }

    const randomPassword = crypto.randomBytes(32).toString('hex');
    const salt = generateSalt();
    const hashedPassword = encryptPassword(randomPassword, salt);
    const displayName = deriveNameFromEmail(normalizedEmail, name);
    const { token, tokenHash } = generateInviteToken();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: userRows } = await client.query(
            `INSERT INTO users (email, password, name, salt, user_level)
             VALUES ($1, $2, $3, $4, 2)
             RETURNING id, email, name`,
            [normalizedEmail, hashedPassword, displayName, salt]
        );
        const newUser = userRows[0];

        await client.query(
            'INSERT INTO tenant_members (tenant_id, user_id, role, is_active) VALUES ($1, $2, $3, true)',
            [tenantId, newUser.id, role]
        );

        const { rows: invRows } = await client.query(
            `INSERT INTO tenant_invitations (tenant_id, user_id, email, role, token_hash, invited_by, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '7 days')
             RETURNING id, email, role, expires_at`,
            [tenantId, newUser.id, normalizedEmail, role, tokenHash, invitedBy]
        );

        await writeAuditLog(client, {
            actorId: invitedBy,
            action: 'member.invite',
            targetType: 'tenant_invitation',
            targetId: invRows[0].id,
            tenantId,
            payload: { email: normalizedEmail, role, accountCreated: true },
        });

        await client.query('COMMIT');

        const setupLink = buildSetupLink(token);
        const emailSent = await trySendInviteEmail(normalizedEmail, setupLink, tenantDisplayName);

        return {
            invitation: {
                id: invRows[0].id,
                email: invRows[0].email,
                role: invRows[0].role,
                expiresAt: invRows[0].expires_at,
                setupLink,
                emailSent,
                accountCreated: true,
            },
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function getInviteInfo(pool, token) {
    const tokenHash = crypto.createHash('sha256').update(String(token).trim()).digest('hex');

    const { rows } = await pool.query(
        `SELECT ti.email, ti.expires_at,
                u.name, t.display_name AS tenant_display_name
         FROM tenant_invitations ti
         JOIN users u ON u.id = ti.user_id
         JOIN tenants t ON t.id = ti.tenant_id
         WHERE ti.token_hash = $1
           AND ti.accepted_at IS NULL
           AND ti.expires_at > NOW()`,
        [tokenHash]
    );

    if (rows.length === 0) {
        const err = new Error('Token inválido ou expirado.');
        err.status = 400;
        throw err;
    }

    const row = rows[0];

    return {
        email: row.email,
        name: row.name,
        tenantDisplayName: row.tenant_display_name,
        expiresAt: row.expires_at,
    };
}

async function acceptInvite(pool, { token, password, name }) {
    if (!password || password.length < 6) {
        const err = new Error('A senha deve ter no mínimo 6 caracteres.');
        err.status = 422;
        throw err;
    }

    const tokenHash = crypto.createHash('sha256').update(String(token).trim()).digest('hex');

    const { rows } = await pool.query(
        `SELECT ti.id, ti.user_id, ti.tenant_id, ti.accepted_at, ti.expires_at
         FROM tenant_invitations ti
         WHERE ti.token_hash = $1 AND ti.accepted_at IS NULL AND ti.expires_at > NOW()`,
        [tokenHash]
    );

    if (rows.length === 0) {
        const err = new Error('Token inválido ou expirado.');
        err.status = 400;
        throw err;
    }

    const invitation = rows[0];
    const salt = generateSalt();
    const hashedPassword = encryptPassword(password, salt);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (name?.trim()) {
            await client.query('UPDATE users SET password = $1, salt = $2, name = $3 WHERE id = $4', [
                hashedPassword, salt, name.trim(), invitation.user_id,
            ]);
        } else {
            await client.query('UPDATE users SET password = $1, salt = $2 WHERE id = $3', [
                hashedPassword, salt, invitation.user_id,
            ]);
        }

        await client.query(
            'UPDATE tenant_invitations SET accepted_at = NOW() WHERE id = $1',
            [invitation.id]
        );

        await writeAuditLog(client, {
            actorId: invitation.user_id,
            action: 'member.invite_accept',
            targetType: 'tenant_member',
            targetId: invitation.user_id,
            tenantId: invitation.tenant_id,
            payload: {},
        });

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    const { rows: userRows } = await pool.query('SELECT * FROM users WHERE id = $1', [invitation.user_id]);
    const user = userRows[0];
    const tenants = await getActiveTenantsForUser(pool, user.id);
    const activeTenant = tenants.length > 0 ? tenants[0] : null;

    const accessToken = buildAccessToken(user.id, { tenant: activeTenant });
    const refreshToken = buildRefreshToken(user.id, { tenantId: activeTenant?.id ?? null });

    return {
        message: 'Convite aceito com sucesso',
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            user_level: Number(user.user_level ?? 1),
            photo_url: user.photo_url,
        },
        accessToken,
        refreshToken,
        tenants,
        activeTenantId: activeTenant?.id ?? null,
    };
}

async function listPendingInvitations(pool, tenantId) {
    const { rows } = await pool.query(
        `SELECT ti.id, ti.email, ti.role, ti.expires_at, ti.token_hash,
                u.name AS invited_by_name
         FROM tenant_invitations ti
         JOIN users u ON u.id = ti.invited_by
         WHERE ti.tenant_id = $1 AND ti.accepted_at IS NULL AND ti.expires_at > NOW()
         ORDER BY ti.created_at DESC`,
        [tenantId]
    );

    return rows.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        expiresAt: row.expires_at,
        invitedByName: row.invited_by_name,
        passwordPending: true,
        setupLink: null,
    }));
}

module.exports = {
    VALID_ROLES,
    buildSetupLink,
    inviteMemberInTransaction,
    inviteMember,
    getInviteInfo,
    acceptInvite,
    listPendingInvitations,
};
