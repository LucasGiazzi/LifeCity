const supabasePool = require('../infra/supabasePool');

exports.list = async (req, res) => {
    const userId = req.user.id;
    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(
            `SELECT
                n.id,
                n.actor_id,
                n.type,
                n.reference_type,
                n.reference_id,
                n.read_at,
                n.created_at,
                actor.name        AS actor_name,
                actor.photo_url   AS actor_photo_url,
                ach.name          AS achievement_name,
                ach.icon          AS achievement_icon,
                ach.xp_reward     AS achievement_xp
             FROM notifications n
             LEFT JOIN users actor ON n.actor_id = actor.id
             LEFT JOIN achievements ach
                ON n.reference_type = 'achievement' AND n.reference_id = ach.id::text
             WHERE n.user_id = $1
             ORDER BY n.created_at DESC
             LIMIT 50`,
            [userId]
        );
        res.status(200).json({ notifications: rows });
    } catch (error) {
        console.error('Erro ao buscar notificações:', error);
        res.status(500).json({ message: 'Erro ao buscar notificações.' });
    }
};

exports.getUnreadCount = async (req, res) => {
    const userId = req.user.id;
    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(
            'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
            [userId]
        );
        res.status(200).json({ count: rows[0].count });
    } catch (error) {
        console.error('Erro ao buscar contagem de notificações:', error);
        res.status(500).json({ message: 'Erro ao buscar contagem.' });
    }
};

exports.markRead = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const pool = await supabasePool.getPgPool();
        await pool.query(
            'UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL',
            [id, userId]
        );
        res.status(200).json({ message: 'Notificação marcada como lida.' });
    } catch (error) {
        console.error('Erro ao marcar notificação:', error);
        res.status(500).json({ message: 'Erro ao marcar notificação.' });
    }
};

exports.markAllRead = async (req, res) => {
    const userId = req.user.id;
    try {
        const pool = await supabasePool.getPgPool();
        await pool.query(
            'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
            [userId]
        );
        res.status(200).json({ message: 'Todas as notificações marcadas como lidas.' });
    } catch (error) {
        console.error('Erro ao marcar notificações:', error);
        res.status(500).json({ message: 'Erro ao marcar notificações.' });
    }
};
