const crypto = require('crypto');
const supabasePool = require('../infra/supabasePool');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function isEncryptionEnabled() {
    return Boolean(process.env.TENANT_MESSAGE_MASTER_KEY);
}

function getMasterKey() {
    const raw = process.env.TENANT_MESSAGE_MASTER_KEY;
    if (!raw) return null;
    const key = Buffer.from(raw, 'base64');
    if (key.length !== KEY_LENGTH) {
        throw new Error('TENANT_MESSAGE_MASTER_KEY deve ter 32 bytes em base64');
    }
    return key;
}

function encryptWithKey(plaintext, key) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        ciphertext: Buffer.concat([encrypted, tag]),
        nonce: iv,
    };
}

function decryptWithKey(ciphertext, nonce, key) {
    const tag = ciphertext.subarray(ciphertext.length - 16);
    const data = ciphertext.subarray(0, ciphertext.length - 16);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function wrapComplaintKey(complaintKey, masterKey) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(complaintKey), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]);
}

function unwrapComplaintKey(wrapped, masterKey) {
    const iv = wrapped.subarray(0, IV_LENGTH);
    const tag = wrapped.subarray(IV_LENGTH, IV_LENGTH + 16);
    const data = wrapped.subarray(IV_LENGTH + 16);
    const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
}

async function getOrCreateComplaintKey(pool, complaintId, tenantId) {
    const masterKey = getMasterKey();

    const { rows } = await pool.query(
        `SELECT encrypted_key FROM complaint_message_keys WHERE complaint_id = $1::bigint`,
        [complaintId]
    );

    if (rows.length > 0) {
        return unwrapComplaintKey(rows[0].encrypted_key, masterKey);
    }

    const complaintKey = crypto.randomBytes(KEY_LENGTH);
    const encryptedKey = wrapComplaintKey(complaintKey, masterKey);

    await pool.query(
        `INSERT INTO complaint_message_keys (complaint_id, tenant_id, encrypted_key)
         VALUES ($1::bigint, $2::uuid, $3)
         ON CONFLICT (complaint_id) DO NOTHING`,
        [complaintId, tenantId, encryptedKey]
    );

    const { rows: after } = await pool.query(
        `SELECT encrypted_key FROM complaint_message_keys WHERE complaint_id = $1::bigint`,
        [complaintId]
    );
    return unwrapComplaintKey(after[0].encrypted_key, masterKey);
}

async function encryptBody(pool, complaintId, tenantId, plaintext) {
    const key = await getOrCreateComplaintKey(pool, complaintId, tenantId);
    return encryptWithKey(plaintext, key);
}

async function decryptBody(pool, complaintId, tenantId, ciphertext, nonce) {
    const key = await getOrCreateComplaintKey(pool, complaintId, tenantId);
    return decryptWithKey(ciphertext, nonce, key);
}

async function logAccess(pool, messageIds, accessorUserId, action) {
    if (!messageIds.length) return;
    for (const messageId of messageIds) {
        await pool.query(
            `INSERT INTO complaint_message_access_log (message_id, accessor_user_id, action)
             VALUES ($1::uuid, $2::uuid, $3)`,
            [messageId, accessorUserId, action]
        ).catch((err) => console.error('[crypto:audit]', err.message));
    }
}

module.exports = {
    isEncryptionEnabled,
    encryptBody,
    decryptBody,
    logAccess,
};
