const supabasePool = require('./supabasePool');

async function calculateTeamBonus(pool, userId, baseXpReward) {
    const { rows: teams } = await pool.query(
        `SELECT t.id FROM teams t
         JOIN team_members tm ON tm.team_id = t.id
         WHERE tm.user_id = $1 AND tm.status = 'active'
         LIMIT 1`,
        [userId]
    );
    if (teams.length === 0) return 0;

    const { rows: otherProgress } = await pool.query(
        `SELECT
            LEAST(
                um.contribution_count::float / GREATEST(mt.goal_count::float, 1),
                1.0
            ) AS ratio
         FROM team_members tm
         JOIN user_missions um ON um.user_id = tm.user_id
         JOIN mission_templates mt ON mt.id = um.mission_template_id
         WHERE tm.team_id = $1
           AND tm.user_id != $2
           AND tm.status = 'active'
           AND um.frequency = 'weekly'
           AND um.created_at >= date_trunc('week', NOW())
           AND um.expires_at > NOW()`,
        [teams[0].id, userId]
    );

    if (otherProgress.length === 0) return 0;

    const avgRatio = otherProgress.reduce((sum, r) => sum + parseFloat(r.ratio), 0)
        / otherProgress.length;

    return Math.floor(baseXpReward * 0.5 * avgRatio);
}

async function completeUserMissionIfReady(pool, userMissionId) {
    const { rows: [um] } = await pool.query(
        `SELECT um.*, mt.goal_count, mt.goal_type, mt.goal_resolved_percent,
                mt.complaint_category, mt.base_xp_reward, mt.frequency
         FROM user_missions um
         JOIN mission_templates mt ON mt.id = um.mission_template_id
         WHERE um.id = $1 AND um.completed_at IS NULL`,
        [userMissionId]
    );
    if (!um) return;
    if (um.contribution_count < um.goal_count) return;

    if (um.goal_type === 'count_and_resolved' && um.goal_resolved_percent) {
        const { rows: [{ resolved_count }] } = await pool.query(
            `SELECT COUNT(DISTINCT c.id)::int AS resolved_count
             FROM complaints c
             WHERE c.created_by = $1
               AND ($2::varchar IS NULL OR c.category = $2)
               AND c.created_at >= $3
               AND c.created_at <= $4
               AND c.status = 'resolved'`,
            [um.user_id, um.complaint_category, um.created_at, um.expires_at]
        );
        const resolvedPct = um.contribution_count > 0
            ? Math.round((resolved_count / um.contribution_count) * 100)
            : 0;
        if (resolvedPct < um.goal_resolved_percent) return;
    }

    // Marca como concluída — previne race condition
    const { rows: claimed } = await pool.query(
        `UPDATE user_missions SET completed_at = NOW()
         WHERE id = $1 AND completed_at IS NULL
         RETURNING id`,
        [userMissionId]
    );
    if (claimed.length === 0) return;

    const xpEarned = um.base_xp_reward;
    let bonusXp = 0;

    if (um.frequency === 'weekly') {
        bonusXp = await calculateTeamBonus(pool, um.user_id, xpEarned);
    }

    await pool.query(
        `UPDATE user_missions SET xp_earned = $1, bonus_xp_earned = $2 WHERE id = $3`,
        [xpEarned, bonusXp, userMissionId]
    );

    await pool.query(
        `UPDATE users SET bonus_xp = bonus_xp + $1 WHERE id = $2`,
        [xpEarned + bonusXp, um.user_id]
    );

    if (bonusXp > 0) {
        await pool.query(
            `UPDATE teams t SET total_xp = total_xp + $1
             FROM team_members tm
             WHERE tm.team_id = t.id AND tm.user_id = $2 AND tm.status = 'active'`,
            [bonusXp, um.user_id]
        );
    }

    pool.query(
        `INSERT INTO notifications (user_id, type, reference_type, reference_id)
         VALUES ($1, 'mission_completed', 'user_mission', $2)`,
        [um.user_id, userMissionId]
    ).catch(err => console.error('[notification:mission_completed]', err.message));
}

async function checkMissionProgress(pool, complaintId) {
    try {
        const { rows: [complaint] } = await pool.query(
            `SELECT id, category, created_by, created_at FROM complaints WHERE id = $1`,
            [complaintId]
        );
        if (!complaint) return;

        const { rows: missions } = await pool.query(
            `SELECT um.id
             FROM user_missions um
             JOIN mission_templates mt ON mt.id = um.mission_template_id
             WHERE um.user_id = $1
               AND um.completed_at IS NULL
               AND um.expires_at > NOW()
               AND $2 >= um.created_at
               AND (mt.complaint_category IS NULL OR mt.complaint_category = $3)`,
            [complaint.created_by, complaint.created_at, complaint.category]
        );

        for (const { id: umId } of missions) {
            await pool.query(
                `UPDATE user_missions SET contribution_count = contribution_count + 1
                 WHERE id = $1`,
                [umId]
            );
            await completeUserMissionIfReady(pool, umId);
        }
    } catch (err) {
        console.error('[missionProgressChecker] Erro:', err.message);
    }
}

async function checkMissionResolution(pool, complaintId) {
    try {
        const { rows: [complaint] } = await pool.query(
            `SELECT id, category, created_by, created_at FROM complaints WHERE id = $1`,
            [complaintId]
        );
        if (!complaint) return;

        const { rows: missions } = await pool.query(
            `SELECT um.id
             FROM user_missions um
             JOIN mission_templates mt ON mt.id = um.mission_template_id
             WHERE um.user_id = $1
               AND um.completed_at IS NULL
               AND um.expires_at > NOW()
               AND mt.goal_type = 'count_and_resolved'
               AND $2 >= um.created_at
               AND (mt.complaint_category IS NULL OR mt.complaint_category = $3)`,
            [complaint.created_by, complaint.created_at, complaint.category]
        );

        for (const { id: umId } of missions) {
            await completeUserMissionIfReady(pool, umId);
        }
    } catch (err) {
        console.error('[missionResolutionChecker] Erro:', err.message);
    }
}

module.exports = { checkMissionProgress, checkMissionResolution };
