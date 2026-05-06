const supabasePool = require('../infra/supabasePool');

exports.getCatalog = async (req, res) => {
    const userId = req.user?.id ?? null;
    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(
            `SELECT
                a.*,
                CASE WHEN $1::uuid IS NOT NULL
                     THEN EXISTS(SELECT 1 FROM user_achievements ua WHERE ua.achievement_id = a.id AND ua.user_id = $1::uuid)
                     ELSE false
                END AS unlocked
             FROM achievements a
             ORDER BY a.trigger_type, a.trigger_count`,
            [userId]
        );
        res.status(200).json({ achievements: rows });
    } catch (error) {
        console.error('Erro ao buscar conquistas:', error);
        res.status(500).json({ message: 'Erro ao buscar conquistas.' });
    }
};

exports.getMyAchievements = async (req, res) => {
    const userId = req.user.id;
    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(
            `SELECT
                a.id,
                a.name,
                a.description,
                a.icon,
                a.xp_reward,
                a.trigger_type,
                a.trigger_count,
                ua.unlocked_at,
                ua.is_featured
             FROM user_achievements ua
             JOIN achievements a ON ua.achievement_id = a.id
             WHERE ua.user_id = $1
             ORDER BY ua.unlocked_at DESC`,
            [userId]
        );
        res.status(200).json({ achievements: rows });
    } catch (error) {
        console.error('Erro ao buscar conquistas do usuário:', error);
        res.status(500).json({ message: 'Erro ao buscar conquistas.' });
    }
};

exports.getUserFeatured = async (req, res) => {
    const { userId } = req.params;
    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(
            `SELECT
                a.id,
                a.name,
                a.description,
                a.icon,
                a.xp_reward
             FROM user_achievements ua
             JOIN achievements a ON ua.achievement_id = a.id
             WHERE ua.user_id = $1 AND ua.is_featured = true
             ORDER BY ua.unlocked_at ASC
             LIMIT 3`,
            [userId]
        );
        res.status(200).json({ achievements: rows });
    } catch (error) {
        console.error('Erro ao buscar conquistas em destaque:', error);
        res.status(500).json({ message: 'Erro ao buscar conquistas.' });
    }
};

exports.setFeatured = async (req, res) => {
    const userId = req.user.id;
    const { achievement_ids } = req.body;

    if (!Array.isArray(achievement_ids) || achievement_ids.length > 3) {
        return res.status(400).json({ message: 'Envie até 3 IDs de conquistas.' });
    }

    try {
        const pool = await supabasePool.getPgPool();

        if (achievement_ids.length > 0) {
            const owns = await pool.query(
                `SELECT achievement_id FROM user_achievements
                 WHERE user_id = $1 AND achievement_id = ANY($2::uuid[])`,
                [userId, achievement_ids]
            );
            if (owns.rows.length !== achievement_ids.length) {
                return res.status(400).json({ message: 'Uma ou mais conquistas não foram desbloqueadas por você.' });
            }
        }

        await pool.query(
            'UPDATE user_achievements SET is_featured = false WHERE user_id = $1',
            [userId]
        );

        if (achievement_ids.length > 0) {
            await pool.query(
                `UPDATE user_achievements
                 SET is_featured = true
                 WHERE user_id = $1 AND achievement_id = ANY($2::uuid[])`,
                [userId, achievement_ids]
            );
        }

        res.status(200).json({ message: 'Conquistas em destaque atualizadas.' });
    } catch (error) {
        console.error('Erro ao definir conquistas em destaque:', error);
        res.status(500).json({ message: 'Erro ao atualizar conquistas.' });
    }
};
