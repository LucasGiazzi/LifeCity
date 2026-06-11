const fs = require('fs');
const path = require('path');
const supabasePool = require('../infra/supabasePool');
const { citizenStatusLabel, statusChangeDescription } = require('./complaintStatusLabels');

const PUSH_ENABLED = process.env.PUSH_ENABLED === 'true';

let messaging = null;

function initFirebase() {
    if (!PUSH_ENABLED || messaging) return messaging;

    try {
        const firebaseAdmin = require('firebase-admin');
        const jsonEnv = process.env.FCM_SERVICE_ACCOUNT_JSON;
        if (!jsonEnv) {
            console.warn('[push] FCM_SERVICE_ACCOUNT_JSON não configurado');
            return null;
        }

        let credentials;
        if (jsonEnv.trim().startsWith('{')) {
            credentials = JSON.parse(jsonEnv);
        } else {
            const filePath = path.resolve(jsonEnv);
            credentials = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }

        if (!firebaseAdmin.apps.length) {
            firebaseAdmin.initializeApp({ credential: firebaseAdmin.credential.cert(credentials) });
        }
        messaging = firebaseAdmin.messaging();
        return messaging;
    } catch (err) {
        console.error('[push] Falha ao inicializar Firebase:', err.message);
        return null;
    }
}

async function registerToken(userId, token, platform, appVersion) {
    const pool = await supabasePool.getPgPool();
    await pool.query(
        `INSERT INTO user_device_tokens (user_id, token, platform, app_version, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, token) DO UPDATE
           SET platform = EXCLUDED.platform,
               app_version = EXCLUDED.app_version,
               updated_at = NOW()`,
        [userId, token, platform, appVersion ?? null]
    );
}

async function unregisterToken(userId, token) {
    const pool = await supabasePool.getPgPool();
    await pool.query(
        'DELETE FROM user_device_tokens WHERE user_id = $1 AND token = $2',
        [userId, token]
    );
}

async function getTokensForUsers(userIds) {
    if (userIds.length === 0) return [];
    const pool = await supabasePool.getPgPool();
    const { rows } = await pool.query(
        `SELECT user_id, token FROM user_device_tokens WHERE user_id = ANY($1::uuid[])`,
        [userIds]
    );
    return rows;
}

async function sendToUsers(userIds, { title, body, data = {} }) {
    if (!PUSH_ENABLED || userIds.length === 0) return;

    const fcm = initFirebase();
    if (!fcm) return;

    const tokenRows = await getTokensForUsers(userIds);
    if (tokenRows.length === 0) return;

    const stringData = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v ?? '')])
    );

    const messages = tokenRows.map(({ token }) => ({
        token,
        notification: { title, body },
        data: stringData,
        android: { priority: 'high' },
    }));

    try {
        const response = await fcm.sendEach(messages);
        const invalidTokens = [];
        response.responses.forEach((res, i) => {
            if (res.error) {
                const code = res.error.code;
                if (code === 'messaging/registration-token-not-registered'
                    || code === 'messaging/invalid-registration-token') {
                    invalidTokens.push(tokenRows[i].token);
                }
            }
        });

        if (invalidTokens.length > 0) {
            const pool = await supabasePool.getPgPool();
            await pool.query(
                'DELETE FROM user_device_tokens WHERE token = ANY($1::text[])',
                [invalidTokens]
            );
        }
    } catch (err) {
        console.error('[push] sendToUsers:', err.message);
    }
}

async function sendComplaintStatus(complaintId, fromStatus, toStatus, userIds) {
    const title = `Ocorrência ${citizenStatusLabel(toStatus).toLowerCase()}`;
    const body = statusChangeDescription(fromStatus, toStatus);
    await sendToUsers(userIds, {
        title,
        body,
        data: {
            type: 'complaint_status',
            complaint_id: String(complaintId),
            from_status: fromStatus,
            to_status: toStatus,
        },
    });
}

async function sendComplaintMessage(complaintId, bodyPreview, userIds) {
    const preview = String(bodyPreview || '').trim().slice(0, 120);
    await sendToUsers(userIds, {
        title: 'Nova mensagem da prefeitura',
        body: preview || 'Toque para ler a mensagem.',
        data: {
            type: 'complaint_message',
            complaint_id: String(complaintId),
            open_chat: 'true',
        },
    });
}

module.exports = {
    registerToken,
    unregisterToken,
    sendToUsers,
    sendComplaintStatus,
    sendComplaintMessage,
};
