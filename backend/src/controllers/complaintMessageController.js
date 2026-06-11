const supabasePool = require('../infra/supabasePool');
const { TENANT_COMPLAINT_FILTER } = require('../services/tenantService');
const pushService = require('../services/pushNotificationService');
const cryptoService = require('../services/messageCryptoService');

const MAX_BODY_LENGTH = 2000;
const RATE_LIMIT = 10;
const DEFAULT_LIMIT = 50;

async function getComplaintForCitizen(pool, complaintId, userId) {
    const { rows } = await pool.query(
        `SELECT c.id, c.created_by, c.tenant_id, t.display_name AS tenant_display_name
         FROM complaints c
         LEFT JOIN tenants t ON t.id = c.tenant_id
         WHERE c.id = $1::bigint AND c.is_hidden = FALSE`,
        [complaintId]
    );
    return rows[0] ?? null;
}

async function getComplaintForAdmin(pool, complaintId, tenantId, cdMun) {
    const { rows } = await pool.query(
        `SELECT c.id, c.created_by, c.tenant_id, t.display_name AS tenant_display_name,
                u.name AS reporter_name
         FROM public.complaints c
         LEFT JOIN tenants t ON t.id = c.tenant_id
         LEFT JOIN users u ON u.id = c.created_by
         WHERE c.id = $3::bigint AND ${TENANT_COMPLAINT_FILTER.trim()}`,
        [tenantId, cdMun, complaintId]
    );
    return rows[0] ?? null;
}

function municipalityDisplayName(tenantDisplayName) {
    const name = tenantDisplayName?.trim() || 'Prefeitura';
    return name.toLowerCase().startsWith('prefeitura') ? name : `Prefeitura de ${name}`;
}

async function checkRateLimit(pool, complaintId, userId) {
    const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM complaint_messages
         WHERE complaint_id = $1::bigint
           AND sender_user_id = $2::uuid
           AND created_at > NOW() - INTERVAL '1 minute'`,
        [complaintId, userId]
    );
    return rows[0].cnt < RATE_LIMIT;
}

async function decryptRow(pool, row, complaintId, tenantId) {
    if (row.body != null) {
        return row.body;
    }
    if (row.body_ciphertext && row.body_nonce && cryptoService.isEncryptionEnabled()) {
        return cryptoService.decryptBody(
            pool,
            complaintId,
            tenantId,
            row.body_ciphertext,
            row.body_nonce
        );
    }
    return '';
}

function formatMessage(row, body, { forCitizen, tenantDisplayName, reporterName }) {
    const base = {
        id: row.id,
        sender_type: row.sender_type,
        body,
        created_at: row.created_at,
        read_by_citizen_at: row.read_by_citizen_at,
        read_by_municipality_at: row.read_by_municipality_at,
    };

    if (row.sender_type === 'municipality') {
        base.display_name = municipalityDisplayName(tenantDisplayName);
    } else if (forCitizen) {
        base.display_name = 'Você';
    } else {
        base.display_name = reporterName || 'Cidadão';
    }

    return base;
}

async function fetchMessages(pool, complaintId, tenantId, { before, limit, forCitizen, tenantDisplayName, reporterName, auditUserId }) {
    const pageLimit = Math.min(parseInt(limit, 10) || DEFAULT_LIMIT, 100);

    let sql;
    let params;
    if (before) {
        sql = `
            SELECT m.id, m.sender_type, m.sender_user_id, m.body,
                   m.body_ciphertext, m.body_nonce,
                   m.created_at, m.read_by_citizen_at, m.read_by_municipality_at
            FROM complaint_messages m
            WHERE m.complaint_id = $1::bigint
              AND m.created_at < (SELECT created_at FROM complaint_messages WHERE id = $2::uuid)
            ORDER BY m.created_at DESC
            LIMIT $3
        `;
        params = [complaintId, before, pageLimit];
    } else {
        sql = `
            SELECT m.id, m.sender_type, m.sender_user_id, m.body,
                   m.body_ciphertext, m.body_nonce,
                   m.created_at, m.read_by_citizen_at, m.read_by_municipality_at
            FROM complaint_messages m
            WHERE m.complaint_id = $1::bigint
            ORDER BY m.created_at DESC
            LIMIT $2
        `;
        params = [complaintId, pageLimit];
    }

    const { rows } = await pool.query(sql, params);

    if (auditUserId && cryptoService.isEncryptionEnabled()) {
        await cryptoService.logAccess(
            pool,
            rows.filter((r) => r.body_ciphertext).map((r) => r.id),
            auditUserId,
            'decrypt_batch'
        );
    }

    const messages = [];
    for (const row of rows) {
        const body = await decryptRow(pool, row, complaintId, tenantId);
        messages.push(formatMessage(row, body, { forCitizen, tenantDisplayName, reporterName }));
    }

    return messages.reverse();
}

async function insertMessage(pool, {
    complaintId,
    tenantId,
    senderType,
    senderUserId,
    body,
}) {
    const trimmed = body.trim();
    const useEncryption = cryptoService.isEncryptionEnabled();

    if (useEncryption) {
        const { ciphertext, nonce } = await cryptoService.encryptBody(
            pool,
            complaintId,
            tenantId,
            trimmed
        );
        const { rows } = await pool.query(
            `INSERT INTO complaint_messages
               (complaint_id, tenant_id, sender_type, sender_user_id, body_ciphertext, body_nonce)
             VALUES ($1::bigint, $2::uuid, $3::complaint_message_sender, $4::uuid, $5, $6)
             RETURNING id, sender_type, created_at, read_by_citizen_at, read_by_municipality_at`,
            [complaintId, tenantId, senderType, senderUserId, ciphertext, nonce]
        );
        return { row: rows[0], body: trimmed };
    }

    const { rows } = await pool.query(
        `INSERT INTO complaint_messages
           (complaint_id, tenant_id, sender_type, sender_user_id, body)
         VALUES ($1::bigint, $2::uuid, $3::complaint_message_sender, $4::uuid, $5)
         RETURNING id, sender_type, body, created_at, read_by_citizen_at, read_by_municipality_at`,
        [complaintId, tenantId, senderType, senderUserId, trimmed]
    );
    return { row: rows[0], body: trimmed };
}

async function notifyAuthorOfMessage(pool, complaintId, authorId, bodyPreview, actorId) {
    const { rows } = await pool.query(
        `SELECT muted_at FROM complaint_watchers
         WHERE complaint_id = $1::bigint AND user_id = $2::uuid`,
        [complaintId, authorId]
    );
    const muted = rows.length > 0 && rows[0].muted_at != null;

    const payload = {
        complaint_id: String(complaintId),
        title: 'Nova mensagem da prefeitura',
        body: bodyPreview.slice(0, 120),
    };

    await pool.query(
        `INSERT INTO notifications (user_id, actor_id, type, reference_type, reference_id, payload)
         VALUES ($1, $2, 'complaint_message', 'complaint', $3, $4::jsonb)`,
        [authorId, actorId, String(complaintId), JSON.stringify(payload)]
    ).catch((err) => console.error('[chat:notify]', err.message));

    if (!muted) {
        pushService.sendComplaintMessage(complaintId, bodyPreview, [authorId])
            .catch((err) => console.error('[chat:push]', err.message));
    }
}

// ─── Citizen ────────────────────────────────────────────────────────────────

exports.getCitizenMessages = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { before, limit } = req.query;

    try {
        const pool = await supabasePool.getPgPool();
        const complaint = await getComplaintForCitizen(pool, id, userId);

        if (!complaint) {
            return res.status(404).json({ message: 'Reclamação não encontrada.' });
        }
        if (complaint.created_by !== userId) {
            return res.status(403).json({ message: 'Apenas o autor pode acessar o chat.' });
        }

        const tenantId = complaint.tenant_id;
        if (!tenantId) {
            return res.status(400).json({ message: 'Ocorrência sem tenant associado.' });
        }

        const messages = await fetchMessages(pool, id, tenantId, {
            before,
            limit,
            forCitizen: true,
            tenantDisplayName: complaint.tenant_display_name,
        });

        res.json({ messages });
    } catch (error) {
        console.error('Erro ao buscar mensagens (citizen):', error);
        res.status(500).json({ message: 'Erro ao buscar mensagens.' });
    }
};

exports.postCitizenMessage = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { body } = req.body ?? {};

    if (!body || !String(body).trim()) {
        return res.status(400).json({ message: 'Mensagem não pode ser vazia.' });
    }
    if (String(body).length > MAX_BODY_LENGTH) {
        return res.status(400).json({ message: `Mensagem limitada a ${MAX_BODY_LENGTH} caracteres.` });
    }

    try {
        const pool = await supabasePool.getPgPool();
        const complaint = await getComplaintForCitizen(pool, id, userId);

        if (!complaint) {
            return res.status(404).json({ message: 'Reclamação não encontrada.' });
        }
        if (complaint.created_by !== userId) {
            return res.status(403).json({ message: 'Apenas o autor pode enviar mensagens.' });
        }
        if (!complaint.tenant_id) {
            return res.status(400).json({ message: 'Ocorrência sem tenant associado.' });
        }

        if (!(await checkRateLimit(pool, id, userId))) {
            return res.status(429).json({ message: 'Aguarde antes de enviar outra mensagem.' });
        }

        const { row, body: plaintext } = await insertMessage(pool, {
            complaintId: id,
            tenantId: complaint.tenant_id,
            senderType: 'citizen',
            senderUserId: userId,
            body: String(body),
        });

        const message = formatMessage(row, plaintext, {
            forCitizen: true,
            tenantDisplayName: complaint.tenant_display_name,
        });

        res.status(201).json({ message });
    } catch (error) {
        console.error('Erro ao enviar mensagem (citizen):', error);
        res.status(500).json({ message: 'Erro ao enviar mensagem.' });
    }
};

exports.patchCitizenRead = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const pool = await supabasePool.getPgPool();
        const complaint = await getComplaintForCitizen(pool, id, userId);

        if (!complaint) {
            return res.status(404).json({ message: 'Reclamação não encontrada.' });
        }
        if (complaint.created_by !== userId) {
            return res.status(403).json({ message: 'Apenas o autor pode marcar mensagens como lidas.' });
        }

        await pool.query(
            `UPDATE complaint_messages
             SET read_by_citizen_at = NOW()
             WHERE complaint_id = $1::bigint
               AND sender_type = 'municipality'
               AND read_by_citizen_at IS NULL`,
            [id]
        );

        res.json({ ok: true });
    } catch (error) {
        console.error('Erro ao marcar lidas (citizen):', error);
        res.status(500).json({ message: 'Erro ao marcar mensagens como lidas.' });
    }
};

// ─── Admin ──────────────────────────────────────────────────────────────────

exports.getAdminMessages = async (req, res) => {
    const { id } = req.params;
    const { before, limit } = req.query;

    try {
        const pool = await supabasePool.getPgPool();
        const complaint = await getComplaintForAdmin(
            pool,
            id,
            req.tenant.id,
            req.tenant.cd_mun
        );

        if (!complaint) {
            return res.status(404).json({ message: 'Ocorrência não encontrada.' });
        }
        if (!complaint.tenant_id) {
            return res.status(400).json({ message: 'Ocorrência sem tenant associado.' });
        }

        const messages = await fetchMessages(pool, id, complaint.tenant_id, {
            before,
            limit,
            forCitizen: false,
            tenantDisplayName: complaint.tenant_display_name,
            reporterName: complaint.reporter_name,
            auditUserId: req.user.id,
        });

        res.json({ messages });
    } catch (error) {
        console.error('Erro ao buscar mensagens (admin):', error);
        res.status(500).json({ message: 'Erro ao buscar mensagens.' });
    }
};

exports.postAdminMessage = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { body } = req.body ?? {};

    if (!body || !String(body).trim()) {
        return res.status(400).json({ message: 'Mensagem não pode ser vazia.' });
    }
    if (String(body).length > MAX_BODY_LENGTH) {
        return res.status(400).json({ message: `Mensagem limitada a ${MAX_BODY_LENGTH} caracteres.` });
    }

    try {
        const pool = await supabasePool.getPgPool();
        const complaint = await getComplaintForAdmin(
            pool,
            id,
            req.tenant.id,
            req.tenant.cd_mun
        );

        if (!complaint) {
            return res.status(404).json({ message: 'Ocorrência não encontrada.' });
        }
        if (!complaint.created_by) {
            return res.status(400).json({ message: 'Ocorrência sem autor — chat indisponível.' });
        }
        if (!complaint.tenant_id) {
            return res.status(400).json({ message: 'Ocorrência sem tenant associado.' });
        }

        if (!(await checkRateLimit(pool, id, userId))) {
            return res.status(429).json({ message: 'Aguarde antes de enviar outra mensagem.' });
        }

        const { row, body: plaintext } = await insertMessage(pool, {
            complaintId: id,
            tenantId: complaint.tenant_id,
            senderType: 'municipality',
            senderUserId: userId,
            body: String(body),
        });

        await notifyAuthorOfMessage(pool, id, complaint.created_by, plaintext, userId);

        const message = formatMessage(row, plaintext, {
            forCitizen: false,
            tenantDisplayName: complaint.tenant_display_name,
            reporterName: complaint.reporter_name,
        });

        res.status(201).json({ message });
    } catch (error) {
        console.error('Erro ao enviar mensagem (admin):', error);
        res.status(500).json({ message: 'Erro ao enviar mensagem.' });
    }
};

exports.patchAdminRead = async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await supabasePool.getPgPool();
        const complaint = await getComplaintForAdmin(
            pool,
            id,
            req.tenant.id,
            req.tenant.cd_mun
        );

        if (!complaint) {
            return res.status(404).json({ message: 'Ocorrência não encontrada.' });
        }

        await pool.query(
            `UPDATE complaint_messages
             SET read_by_municipality_at = NOW()
             WHERE complaint_id = $1::bigint
               AND sender_type = 'citizen'
               AND read_by_municipality_at IS NULL`,
            [id]
        );

        res.json({ ok: true });
    } catch (error) {
        console.error('Erro ao marcar lidas (admin):', error);
        res.status(500).json({ message: 'Erro ao marcar mensagens como lidas.' });
    }
};
