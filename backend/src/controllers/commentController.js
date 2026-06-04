const supabasePool = require('../infra/supabasePool');
const jwt = require('jsonwebtoken');
const { checkAchievements } = require('../infra/achievementChecker');

exports.getComments = async (req, res) => {
    const { id } = req.params;

    // Optional auth — needed to compute liked_by_me
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

        const result = await pool.query(`
            SELECT
                c.id,
                c.complaint_id,
                c.user_id,
                c.text,
                c.created_at,
                u.name       AS user_name,
                u.photo_url  AS user_photo,
                (SELECT COUNT(*)::int FROM comment_likes cl WHERE cl.comment_id = c.id) AS likes_count,
                CASE
                    WHEN $2::uuid IS NOT NULL
                    THEN EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $2::uuid)
                    ELSE false
                END AS liked_by_me
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.complaint_id = $1
            ORDER BY likes_count DESC, c.created_at ASC
        `, [id, userId || null]);

        res.status(200).json({ comments: result.rows });
    } catch (error) {
        console.error('Erro ao buscar comentários:', error);
        res.status(500).json({ message: 'Erro ao buscar comentários.' });
    }
};

exports.addComment = async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    if (!text || text.trim() === '') {
        return res.status(400).json({ message: 'O texto do comentário é obrigatório.' });
    }

    try {
        const pool = await supabasePool.getPgPool();

        const complaintCheck = await pool.query(
            'SELECT id, created_by FROM complaints WHERE id = $1', [id]
        );
        if (complaintCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Reclamação não encontrada.' });
        }
        const ownerId = complaintCheck.rows[0].created_by;

        const insert = await pool.query(
            'INSERT INTO comments (complaint_id, user_id, text) VALUES ($1, $2, $3) RETURNING id',
            [id, userId, text.trim()]
        );

        const result = await pool.query(`
            SELECT
                c.id,
                c.complaint_id,
                c.user_id,
                c.text,
                c.created_at,
                u.name       AS user_name,
                u.photo_url  AS user_photo,
                0            AS likes_count,
                false        AS liked_by_me
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.id = $1
        `, [insert.rows[0].id]);

        res.status(201).json({ comment: result.rows[0] });

        // Side effects após resposta (fire-and-forget)
        if (ownerId !== userId) {
            pool.query(
                `INSERT INTO notifications (user_id, actor_id, type, reference_type, reference_id)
                 VALUES ($1, $2, 'comment', 'complaint', $3)`,
                [ownerId, userId, id.toString()]
            ).catch(err => console.error('[notification:comment]', err.message));
        }
        checkAchievements(ownerId, 'comments_received');
    } catch (error) {
        console.error('Erro ao adicionar comentário:', error);
        res.status(500).json({ message: 'Erro ao adicionar comentário.' });
    }
};

exports.toggleCommentLike = async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.id;

    try {
        const pool = await supabasePool.getPgPool();

        const existing = await pool.query(
            'SELECT id FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
            [commentId, userId]
        );

        let liked;
        if (existing.rows.length > 0) {
            await pool.query(
                'DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
                [commentId, userId]
            );
            liked = false;
        } else {
            await pool.query(
                'INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)',
                [commentId, userId]
            );
            liked = true;
        }

        const countResult = await pool.query(
            'SELECT COUNT(*)::int AS count FROM comment_likes WHERE comment_id = $1',
            [commentId]
        );

        res.status(200).json({ liked, count: countResult.rows[0].count });
    } catch (error) {
        console.error('Erro ao processar like no comentário:', error);
        res.status(500).json({ message: 'Erro ao processar like.' });
    }
};
