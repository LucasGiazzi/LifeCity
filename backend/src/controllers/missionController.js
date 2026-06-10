const supabasePool = require('../infra/supabasePool');
const { uploadPublicFile, deletePublicFile } = require('../infra/supabaseStorageClient');

function getDailyExpiry() {
    const now = new Date();
    return new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59
    ));
}

function getWeeklyExpiry() {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = domingo
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    return new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(),
        now.getUTCDate() + daysUntilSunday, 23, 59, 59
    ));
}

async function ensureMission(pool, userId, frequency) {
    const expiry = frequency === 'daily' ? getDailyExpiry() : getWeeklyExpiry();
    const checkSql = frequency === 'daily'
        ? `SELECT id FROM user_missions
           WHERE user_id = $1 AND frequency = 'daily'
             AND created_at >= CURRENT_DATE AND expires_at > NOW()
           LIMIT 1`
        : `SELECT id FROM user_missions
           WHERE user_id = $1 AND frequency = 'weekly'
             AND created_at >= date_trunc('week', NOW()) AND expires_at > NOW()
           LIMIT 1`;

    const { rows: existing } = await pool.query(checkSql, [userId]);
    if (existing.length > 0) return;

    const { rows: templates } = await pool.query(
        `SELECT id FROM mission_templates
         WHERE frequency = $1 AND is_active = TRUE
         ORDER BY RANDOM() LIMIT 1`,
        [frequency]
    );
    if (templates.length === 0) return;

    try {
        await pool.query(
            `INSERT INTO user_missions (user_id, mission_template_id, frequency, expires_at)
             VALUES ($1, $2, $3, $4)`,
            [userId, templates[0].id, frequency, expiry]
        );
    } catch (err) {
        if (!err.message.includes('duplicate')) {
            console.error('[ensureMission] Erro:', err.message);
        }
    }
}

// ── Missões ───────────────────────────────────────────────────────────────────

exports.getMyMissions = async (req, res) => {
    const userId = req.user.id;
    try {
        const pool = await supabasePool.getPgPool();

        await ensureMission(pool, userId, 'daily');
        await ensureMission(pool, userId, 'weekly');

        const { rows } = await pool.query(
            `SELECT
                um.id, um.frequency, um.contribution_count, um.xp_earned,
                um.bonus_xp_earned, um.completed_at, um.expires_at, um.created_at,
                mt.title, mt.description, mt.goal_type, mt.goal_count,
                mt.goal_resolved_percent, mt.complaint_category, mt.base_xp_reward
             FROM user_missions um
             JOIN mission_templates mt ON mt.id = um.mission_template_id
             WHERE um.user_id = $1
               AND um.expires_at > NOW()
               AND um.created_at >= (
                   CASE um.frequency
                     WHEN 'daily'  THEN CURRENT_DATE::timestamptz
                     ELSE date_trunc('week', NOW())
                   END
               )`,
            [userId]
        );

        res.json({
            daily:  rows.find(r => r.frequency === 'daily')  ?? null,
            weekly: rows.find(r => r.frequency === 'weekly') ?? null,
        });
    } catch (error) {
        console.error('Erro ao listar missões:', error);
        res.status(500).json({ message: 'Erro ao listar missões.' });
    }
};

exports.getMissionById = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        const pool = await supabasePool.getPgPool();
        const { rows: [mission] } = await pool.query(
            `SELECT
                um.id, um.frequency, um.contribution_count, um.xp_earned,
                um.bonus_xp_earned, um.completed_at, um.expires_at, um.created_at,
                mt.title, mt.description, mt.goal_type, mt.goal_count,
                mt.goal_resolved_percent, mt.complaint_category, mt.base_xp_reward
             FROM user_missions um
             JOIN mission_templates mt ON mt.id = um.mission_template_id
             WHERE um.id = $1 AND um.user_id = $2`,
            [id, userId]
        );
        if (!mission) return res.status(404).json({ message: 'Missão não encontrada.' });
        res.json({ mission });
    } catch (error) {
        console.error('Erro ao buscar missão:', error);
        res.status(500).json({ message: 'Erro ao buscar missão.' });
    }
};

// ── Equipes ───────────────────────────────────────────────────────────────────

exports.getTeams = async (req, res) => {
    const userId = req.user.id;
    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(
            `SELECT
                t.id, t.name, t.creator_id, t.total_xp, t.created_at,
                t.description, t.photo_url,
                (SELECT COUNT(*)::int FROM team_members
                 WHERE team_id = t.id AND status = 'active') AS member_count,
                tm.status AS my_status
             FROM teams t
             JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $1
             ORDER BY t.created_at DESC`,
            [userId]
        );
        res.json({ teams: rows });
    } catch (error) {
        console.error('Erro ao listar equipes:', error);
        res.status(500).json({ message: 'Erro ao listar equipes.' });
    }
};

exports.createTeam = async (req, res) => {
    const { name } = req.body;
    const creatorId = req.user.id;

    if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Nome da equipe é obrigatório.' });
    }

    try {
        const pool = await supabasePool.getPgPool();

        const { rows: existing } = await pool.query(
            `SELECT id FROM teams WHERE creator_id = $1 LIMIT 1`,
            [creatorId]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Você já criou uma equipe. Só é permitido criar uma equipe por usuário.' });
        }

        const { rows: [team] } = await pool.query(
            `INSERT INTO teams (name, creator_id) VALUES ($1, $2) RETURNING *`,
            [name.trim(), creatorId]
        );
        await pool.query(
            `INSERT INTO team_members (team_id, user_id, status) VALUES ($1, $2, 'active')`,
            [team.id, creatorId]
        );
        res.status(201).json({ message: 'Equipe criada.', team });
    } catch (error) {
        console.error('Erro ao criar equipe:', error);
        res.status(500).json({ message: 'Erro ao criar equipe.' });
    }
};

exports.getTeamById = async (req, res) => {
    const { id: teamId } = req.params;
    const userId = req.user.id;
    try {
        const pool = await supabasePool.getPgPool();

        const { rows: [membership] } = await pool.query(
            `SELECT status FROM team_members WHERE team_id = $1 AND user_id = $2`,
            [teamId, userId]
        );
        if (!membership) {
            return res.status(403).json({ message: 'Você não faz parte desta equipe.' });
        }

        const { rows: [team] } = await pool.query(
            `SELECT * FROM teams WHERE id = $1`, [teamId]
        );
        if (!team) return res.status(404).json({ message: 'Equipe não encontrada.' });

        const { rows: members } = await pool.query(
            `SELECT tm.user_id, tm.status, tm.joined_at, u.name, u.photo_url
             FROM team_members tm
             JOIN users u ON u.id = tm.user_id
             WHERE tm.team_id = $1
             ORDER BY tm.joined_at ASC`,
            [teamId]
        );

        res.json({ team: { ...team, my_status: membership.status }, members });
    } catch (error) {
        console.error('Erro ao buscar equipe:', error);
        res.status(500).json({ message: 'Erro ao buscar equipe.' });
    }
};

exports.inviteToTeam = async (req, res) => {
    const { id: teamId } = req.params;
    const { user_id: targetUserId } = req.body;
    const requesterId = req.user.id;

    if (!targetUserId) {
        return res.status(400).json({ message: 'user_id é obrigatório.' });
    }

    try {
        const pool = await supabasePool.getPgPool();

        const { rows: [team] } = await pool.query(
            `SELECT id, creator_id FROM teams WHERE id = $1`, [teamId]
        );
        if (!team) return res.status(404).json({ message: 'Equipe não encontrada.' });
        if (team.creator_id !== requesterId) {
            return res.status(403).json({ message: 'Apenas o criador pode convidar membros.' });
        }

        const { rows: [{ count }] } = await pool.query(
            `SELECT COUNT(*)::int AS count FROM team_members
             WHERE team_id = $1 AND status = 'active'`,
            [teamId]
        );
        if (count >= 7) {
            return res.status(400).json({ message: 'A equipe já atingiu o limite de 7 membros.' });
        }

        const { rows: existing } = await pool.query(
            `SELECT status FROM team_members WHERE team_id = $1 AND user_id = $2`,
            [teamId, targetUserId]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Usuário já é membro ou foi convidado.' });
        }

        const { rows: joinedTeams } = await pool.query(
            `SELECT tm.team_id FROM team_members tm
             JOIN teams t ON t.id = tm.team_id
             WHERE tm.user_id = $1 AND tm.status = 'active' AND t.creator_id != $1
             LIMIT 1`,
            [targetUserId]
        );
        if (joinedTeams.length > 0) {
            return res.status(400).json({ message: 'Esse usuário já atingiu o limite de equipes que pode entrar (máximo 1).' });
        }

        await pool.query(
            `INSERT INTO team_members (team_id, user_id, status) VALUES ($1, $2, 'pending')`,
            [teamId, targetUserId]
        );

        pool.query(
            `INSERT INTO notifications (user_id, actor_id, type, reference_type, reference_id)
             VALUES ($1, $2, 'team_invite', 'team', $3)`,
            [targetUserId, requesterId, teamId]
        ).catch(err => console.error('[notification:team_invite]', err.message));

        res.json({ message: 'Convite enviado.' });
    } catch (error) {
        console.error('Erro ao convidar:', error);
        res.status(500).json({ message: 'Erro ao enviar convite.' });
    }
};

exports.acceptTeamInvite = async (req, res) => {
    const { id: teamId } = req.params;
    const userId = req.user.id;
    try {
        const pool = await supabasePool.getPgPool();

        const { rows: [{ count }] } = await pool.query(
            `SELECT COUNT(*)::int AS count FROM team_members
             WHERE team_id = $1 AND status = 'active'`,
            [teamId]
        );
        if (count >= 7) {
            return res.status(400).json({ message: 'A equipe já está cheia (máximo 7 membros).' });
        }

        const { rows: joinedTeams } = await pool.query(
            `SELECT tm.team_id FROM team_members tm
             JOIN teams t ON t.id = tm.team_id
             WHERE tm.user_id = $1 AND tm.status = 'active' AND t.creator_id != $1
             LIMIT 1`,
            [userId]
        );
        if (joinedTeams.length > 0) {
            return res.status(400).json({ message: 'Você já faz parte de uma equipe como membro. Limite de 1 equipe entrável atingido.' });
        }

        const result = await pool.query(
            `UPDATE team_members SET status = 'active', joined_at = NOW()
             WHERE team_id = $1 AND user_id = $2 AND status = 'pending'
             RETURNING id`,
            [teamId, userId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Convite não encontrado ou já processado.' });
        }
        res.json({ message: 'Você entrou na equipe!' });
    } catch (error) {
        console.error('Erro ao aceitar convite:', error);
        res.status(500).json({ message: 'Erro ao aceitar convite.' });
    }
};

exports.rejectTeamInvite = async (req, res) => {
    const { id: teamId } = req.params;
    const userId = req.user.id;
    try {
        const pool = await supabasePool.getPgPool();
        const result = await pool.query(
            `UPDATE team_members SET status = 'rejected'
             WHERE team_id = $1 AND user_id = $2 AND status = 'pending'
             RETURNING id`,
            [teamId, userId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Convite não encontrado ou já processado.' });
        }
        res.json({ message: 'Convite recusado.' });
    } catch (error) {
        console.error('Erro ao recusar convite:', error);
        res.status(500).json({ message: 'Erro ao recusar convite.' });
    }
};

exports.editTeam = async (req, res) => {
    const { id: teamId } = req.params;
    const userId = req.user.id;
    const { name, description } = req.body;
    const photo = req.file;

    try {
        const pool = await supabasePool.getPgPool();

        const { rows: [team] } = await pool.query(
            `SELECT id, creator_id, photo_path FROM teams WHERE id = $1`, [teamId]
        );
        if (!team) return res.status(404).json({ message: 'Equipe não encontrada.' });
        if (team.creator_id !== userId) {
            return res.status(403).json({ message: 'Apenas o criador pode editar a equipe.' });
        }

        let photoUrl, photoPath;
        if (photo) {
            if (team.photo_path) {
                await deletePublicFile({ bucket: 'teams', path: team.photo_path }).catch(() => {});
            }
            const uploaded = await uploadPublicFile({
                bucket: 'teams',
                path: `${teamId}/photo_${Date.now()}.png`,
                file: photo,
            });
            photoUrl = uploaded.publicUrl;
            photoPath = uploaded.path;
        }

        const updates = [];
        const values = [];
        let idx = 1;

        if (name && name.trim()) { updates.push(`name = $${idx++}`); values.push(name.trim()); }
        if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description || null); }
        if (photoUrl) { updates.push(`photo_url = $${idx++}`); values.push(photoUrl); }
        if (photoPath) { updates.push(`photo_path = $${idx++}`); values.push(photoPath); }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'Nenhum campo para atualizar.' });
        }

        values.push(teamId);
        const { rows: [updated] } = await pool.query(
            `UPDATE teams SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );

        res.json({ message: 'Equipe atualizada.', team: updated });
    } catch (error) {
        console.error('Erro ao editar equipe:', error);
        res.status(500).json({ message: 'Erro ao editar equipe.' });
    }
};

exports.getTeamMessages = async (req, res) => {
    const { id: teamId } = req.params;
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before;

    try {
        const pool = await supabasePool.getPgPool();

        const { rows: [membership] } = await pool.query(
            `SELECT status FROM team_members WHERE team_id = $1 AND user_id = $2`,
            [teamId, userId]
        );
        if (!membership || membership.status !== 'active') {
            return res.status(403).json({ message: 'Você não faz parte desta equipe.' });
        }

        let sql, params;
        if (before) {
            sql = `
                SELECT tm.id, tm.content, tm.created_at,
                       u.id AS user_id, u.name AS user_name, u.photo_url AS user_photo_url
                FROM team_messages tm
                JOIN users u ON u.id = tm.user_id
                WHERE tm.team_id = $1
                  AND tm.created_at < (SELECT created_at FROM team_messages WHERE id = $2)
                ORDER BY tm.created_at DESC
                LIMIT $3
            `;
            params = [teamId, before, limit];
        } else {
            sql = `
                SELECT tm.id, tm.content, tm.created_at,
                       u.id AS user_id, u.name AS user_name, u.photo_url AS user_photo_url
                FROM team_messages tm
                JOIN users u ON u.id = tm.user_id
                WHERE tm.team_id = $1
                ORDER BY tm.created_at DESC
                LIMIT $2
            `;
            params = [teamId, limit];
        }

        const { rows } = await pool.query(sql, params);
        res.json({ messages: rows.reverse() });
    } catch (error) {
        console.error('Erro ao buscar mensagens:', error);
        res.status(500).json({ message: 'Erro ao buscar mensagens.' });
    }
};

exports.sendTeamMessage = async (req, res) => {
    const { id: teamId } = req.params;
    const userId = req.user.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Mensagem não pode ser vazia.' });
    }

    try {
        const pool = await supabasePool.getPgPool();

        const { rows: [membership] } = await pool.query(
            `SELECT status FROM team_members WHERE team_id = $1 AND user_id = $2`,
            [teamId, userId]
        );
        if (!membership || membership.status !== 'active') {
            return res.status(403).json({ message: 'Você não faz parte desta equipe.' });
        }

        const { rows: [msg] } = await pool.query(
            `WITH inserted AS (
                INSERT INTO team_messages (team_id, user_id, content)
                VALUES ($1, $2, $3)
                RETURNING id, user_id, content, created_at
            )
            SELECT ins.id, ins.content, ins.created_at,
                   u.id AS user_id, u.name AS user_name, u.photo_url AS user_photo_url
            FROM inserted ins
            JOIN users u ON u.id = ins.user_id`,
            [teamId, userId, content.trim()]
        );

        res.status(201).json({ message: msg });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).json({ message: 'Erro ao enviar mensagem.' });
    }
};
