const supabasePool = require('../infra/supabasePool');
const jwt = require('jsonwebtoken');

exports.getStatus = async (req, res) => {
    const { id } = req.params;

    // Optional auth — extract userId if token present
    let userId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.userId;
        } catch (_) { /* ignore invalid/expired token */ }
    }

    try {
        const pool = await supabasePool.getPgPool();

        const countResult = await pool.query(
            'SELECT COUNT(*)::int AS count FROM complaint_likes WHERE complaint_id = $1',
            [id]
        );

        let liked = false;
        if (userId) {
            const existing = await pool.query(
                'SELECT id FROM complaint_likes WHERE complaint_id = $1 AND user_id = $2',
                [id, userId]
            );
            liked = existing.rows.length > 0;
        }

        res.status(200).json({ liked, count: countResult.rows[0].count });
    } catch (error) {
        console.error('Erro ao buscar likes:', error);
        res.status(500).json({ message: 'Erro ao buscar likes.' });
    }
};

exports.toggle = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const pool = await supabasePool.getPgPool();

        const existing = await pool.query(
            'SELECT id FROM complaint_likes WHERE complaint_id = $1 AND user_id = $2',
            [id, userId]
        );

        let liked;
        if (existing.rows.length > 0) {
            await pool.query(
                'DELETE FROM complaint_likes WHERE complaint_id = $1 AND user_id = $2',
                [id, userId]
            );
            liked = false;
        } else {
            await pool.query(
                'INSERT INTO complaint_likes (complaint_id, user_id) VALUES ($1, $2)',
                [id, userId]
            );
            liked = true;
        }

        const countResult = await pool.query(
            'SELECT COUNT(*)::int AS count FROM complaint_likes WHERE complaint_id = $1',
            [id]
        );

        res.status(200).json({ liked, count: countResult.rows[0].count });
    } catch (error) {
        console.error('Erro ao processar like:', error);
        res.status(500).json({ message: 'Erro ao processar like.' });
    }
};
