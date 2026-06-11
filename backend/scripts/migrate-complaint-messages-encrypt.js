#!/usr/bin/env node
/**
 * Migra mensagens plaintext (body) para ciphertext (5e).
 * Requer TENANT_MESSAGE_MASTER_KEY no ambiente.
 *
 * Uso: node backend/scripts/migrate-complaint-messages-encrypt.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const supabasePool = require('../src/infra/supabasePool');
const cryptoService = require('../src/services/messageCryptoService');

async function main() {
    if (!cryptoService.isEncryptionEnabled()) {
        console.error('TENANT_MESSAGE_MASTER_KEY não configurada.');
        process.exit(1);
    }

    const pool = await supabasePool.getPgPool();

    const { rows } = await pool.query(
        `SELECT id, complaint_id, tenant_id, body
         FROM complaint_messages
         WHERE body IS NOT NULL
           AND body_ciphertext IS NULL
         ORDER BY created_at ASC`
    );

    console.log(`Mensagens a migrar: ${rows.length}`);

    let migrated = 0;
    for (const row of rows) {
        const { ciphertext, nonce } = await cryptoService.encryptBody(
            pool,
            row.complaint_id,
            row.tenant_id,
            row.body
        );

        await pool.query(
            `UPDATE complaint_messages
             SET body = NULL, body_ciphertext = $2, body_nonce = $3
             WHERE id = $1::uuid`,
            [row.id, ciphertext, nonce]
        );
        migrated += 1;
    }

    console.log(`Migradas: ${migrated}`);
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
