const supabasePool = require('./supabasePool');

const countQueries = {
    complaint_created: (pool, userId) =>
        pool.query(
            'SELECT COUNT(*)::int AS n FROM complaints WHERE created_by = $1',
            [userId]
        ),
    likes_received: (pool, userId) =>
        pool.query(
            `SELECT COUNT(*)::int AS n
             FROM complaint_likes cl
             JOIN complaints c ON cl.complaint_id = c.id
             WHERE c.created_by = $1`,
            [userId]
        ),
    comments_received: (pool, userId) =>
        pool.query(
            `SELECT COUNT(*)::int AS n
             FROM comments cm
             JOIN complaints c ON cm.complaint_id = c.id
             WHERE c.created_by = $1`,
            [userId]
        ),
};

async function checkAchievements(userId, triggerType) {
    try {
        const pool = await supabasePool.getPgPool();
        const query = countQueries[triggerType];
        if (!query) return;

        const { rows: [{ n: currentCount }] } = await query(pool, userId);

        const { rows: toUnlock } = await pool.query(
            `SELECT a.id, a.name
             FROM achievements a
             WHERE a.trigger_type = $1
               AND a.trigger_count <= $2
               AND NOT EXISTS (
                 SELECT 1 FROM user_achievements ua
                 WHERE ua.achievement_id = a.id AND ua.user_id = $3
               )`,
            [triggerType, currentCount, userId]
        );

        for (const ach of toUnlock) {
            const ins = await pool.query(
                `INSERT INTO user_achievements (user_id, achievement_id)
                 VALUES ($1, $2)
                 ON CONFLICT (user_id, achievement_id) DO NOTHING
                 RETURNING id`,
                [userId, ach.id]
            );
            if (ins.rows.length > 0) {
                await pool.query(
                    `INSERT INTO notifications (user_id, type, reference_type, reference_id)
                     VALUES ($1, 'achievement_unlocked', 'achievement', $2)`,
                    [userId, ach.id]
                );
            }
        }
    } catch (err) {
        console.error('[achievementChecker] Erro:', err.message);
    }
}

module.exports = { checkAchievements };
