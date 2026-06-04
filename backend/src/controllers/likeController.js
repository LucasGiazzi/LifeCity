const supabasePool = require('../infra/supabasePool');
const jwt = require('jsonwebtoken');
const { checkAchievements } = require('../infra/achievementChecker');

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
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(403).json({ message: 'Token expirado.' });
            }
        }
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

        let ownerId = null;
        if (liked) {
            const complaint = await pool.query(
                'SELECT created_by FROM complaints WHERE id = $1', [id]
            );
            ownerId = complaint.rows[0]?.created_by ?? null;
        }

        res.status(200).json({ liked, count: countResult.rows[0].count });

        // Side effects após resposta (fire-and-forget)
        if (liked && ownerId) {
            if (ownerId !== userId) {
                pool.query(
                    `INSERT INTO notifications (user_id, actor_id, type, reference_type, reference_id)
                     VALUES ($1, $2, 'like', 'complaint', $3)`,
                    [ownerId, userId, id.toString()]
                ).catch(err => console.error('[notification:like]', err.message));
            }
            checkAchievements(ownerId, 'likes_received');
        }
    } catch (error) {
        console.error('Erro ao processar like:', error);
        res.status(500).json({ message: 'Erro ao processar like.' });
    }
};
