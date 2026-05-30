const supabasePool = require('../infra/supabasePool');

const COMPLAINT_HIDE_THRESHOLD = 5;
const USER_RESTRICT_THRESHOLD = 10;

exports.create = async (req, res) => {
    const reporter_id = req.user.id;
    const { target_type, target_id, reason, details } = req.body;

    if (!target_type || !target_id || !reason) {
        return res.status(400).json({ message: 'target_type, target_id e reason são obrigatórios.' });
    }

    if (!['complaint', 'user'].includes(target_type)) {
        return res.status(400).json({ message: 'target_type inválido.' });
    }

    const complaintReasons = ['false_info', 'wrong_location', 'offensive', 'spam', 'duplicate'];
    const userReasons = ['abusive_behavior', 'fake_account', 'spam', 'systematic_false_info'];
    const validReasons = target_type === 'complaint' ? complaintReasons : userReasons;

    if (!validReasons.includes(reason)) {
        return res.status(400).json({ message: 'Motivo inválido para este tipo de denúncia.' });
    }

    if (target_type === 'user' && target_id === reporter_id) {
        return res.status(400).json({ message: 'Você não pode se denunciar.' });
    }

    const pool = await supabasePool.getPgPool();

    try {
        await pool.query(
            `INSERT INTO reports (reporter_id, target_type, target_id, reason, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [reporter_id, target_type, target_id, reason, details || null]
        );
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ message: 'Você já denunciou este conteúdo.' });
        }
        throw err;
    }

    // Conta denúncias únicas pendentes para o alvo
    const countResult = await pool.query(
        `SELECT COUNT(*) AS cnt FROM reports
         WHERE target_type = $1 AND target_id = $2 AND status = 'pending'`,
        [target_type, target_id]
    );
    const count = parseInt(countResult.rows[0].cnt, 10);

    if (target_type === 'complaint' && count >= COMPLAINT_HIDE_THRESHOLD) {
        await pool.query(
            `UPDATE complaints SET is_hidden = TRUE WHERE id = $1 AND is_hidden = FALSE`,
            [target_id]
        );
    }

    if (target_type === 'user' && count >= USER_RESTRICT_THRESHOLD) {
        await pool.query(
            `UPDATE users SET is_restricted = TRUE WHERE id = $1 AND is_restricted = FALSE`,
            [target_id]
        );
    }

    return res.status(201).json({ message: 'Denúncia registrada com sucesso.' });
};
