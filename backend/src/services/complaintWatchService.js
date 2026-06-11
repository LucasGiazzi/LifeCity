const {
    BASIC_NOTIFY_STATUSES,
    citizenStatusLabel,
    statusChangeDescription,
} = require('./complaintStatusLabels');

async function upsertWatch(pool, complaintId, userId, level, source) {
    await pool.query(
        `INSERT INTO complaint_watchers (complaint_id, user_id, level, source)
         VALUES ($1::bigint, $2::uuid, $3::complaint_watch_level, $4::complaint_watch_source)
         ON CONFLICT (complaint_id, user_id) DO UPDATE
           SET level = CASE
                 WHEN complaint_watchers.source = 'creator' THEN complaint_watchers.level
                 WHEN EXCLUDED.level = 'full' THEN 'full'::complaint_watch_level
                 WHEN complaint_watchers.level = 'full' THEN 'full'::complaint_watch_level
                 ELSE EXCLUDED.level
               END,
               source = CASE
                 WHEN complaint_watchers.source = 'creator' THEN 'creator'::complaint_watch_source
                 WHEN EXCLUDED.source = 'witness' THEN 'witness'::complaint_watch_source
                 WHEN complaint_watchers.source = 'witness' THEN 'witness'::complaint_watch_source
                 ELSE EXCLUDED.source
               END,
               updated_at = NOW()`,
        [complaintId, userId, level, source]
    );
}

async function getWatch(pool, complaintId, userId) {
    const { rows } = await pool.query(
        `SELECT level, source, muted_at IS NOT NULL AS muted
         FROM complaint_watchers
         WHERE complaint_id = $1::bigint AND user_id = $2::uuid`,
        [complaintId, userId]
    );
    return rows[0] ?? null;
}

async function syncWatchFromCreate(pool, complaintId, userId) {
    await upsertWatch(pool, complaintId, userId, 'full', 'creator');
}

async function syncWatchFromLike(pool, complaintId, userId, liked) {
    if (liked) {
        const witness = await pool.query(
            `SELECT 1 FROM complaint_witnesses
             WHERE complaint_id = $1 AND user_id = $2`,
            [complaintId, userId]
        );
        if (witness.rows.length > 0) {
            await upsertWatch(pool, complaintId, userId, 'full', 'witness');
        } else {
            await upsertWatch(pool, complaintId, userId, 'basic', 'like');
        }
        return;
    }

    const row = await getWatch(pool, complaintId, userId);
    if (!row || row.source === 'creator') return;

    const witness = await pool.query(
        `SELECT 1 FROM complaint_witnesses
         WHERE complaint_id = $1 AND user_id = $2`,
        [complaintId, userId]
    );
    if (witness.rows.length > 0) {
        await upsertWatch(pool, complaintId, userId, 'full', 'witness');
        return;
    }

    await pool.query(
        `DELETE FROM complaint_watchers
         WHERE complaint_id = $1::bigint AND user_id = $2::uuid
           AND source IN ('like', 'manual')`,
        [complaintId, userId]
    );
}

async function syncWatchFromWitness(pool, complaintId, userId, witnessed) {
    if (witnessed) {
        await upsertWatch(pool, complaintId, userId, 'full', 'witness');
        return;
    }

    const row = await getWatch(pool, complaintId, userId);
    if (!row || row.source === 'creator') return;

    const liked = await pool.query(
        `SELECT 1 FROM complaint_likes
         WHERE complaint_id = $1 AND user_id = $2`,
        [complaintId, userId]
    );
    if (liked.rows.length > 0) {
        await upsertWatch(pool, complaintId, userId, 'basic', 'like');
    } else {
        await pool.query(
            `DELETE FROM complaint_watchers
             WHERE complaint_id = $1::bigint AND user_id = $2::uuid
               AND source IN ('witness', 'like', 'manual')`,
            [complaintId, userId]
        );
    }
}

async function setMuted(pool, complaintId, userId, muted) {
    await pool.query(
        `UPDATE complaint_watchers
         SET muted_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
             updated_at = NOW()
         WHERE complaint_id = $1::bigint AND user_id = $2::uuid`,
        [complaintId, userId, muted]
    );
}

async function setManualLevel(pool, complaintId, userId, level) {
    await upsertWatch(pool, complaintId, userId, level, 'manual');
}

async function removeWatchIfAllowed(pool, complaintId, userId) {
    const { rowCount } = await pool.query(
        `DELETE FROM complaint_watchers
         WHERE complaint_id = $1::bigint AND user_id = $2::uuid
           AND source IN ('like', 'manual', 'witness')
           AND NOT EXISTS (
             SELECT 1 FROM complaints c
             WHERE c.id = $1::bigint AND c.created_by = $2::uuid
           )`,
        [complaintId, userId]
    );
    return rowCount > 0;
}

async function getWatchersForStatusNotify(pool, complaintId, _fromStatus, toStatus) {
    const notifyBasic = BASIC_NOTIFY_STATUSES.has(toStatus);

    const { rows } = await pool.query(
        `SELECT user_id, level::text AS level
         FROM complaint_watchers
         WHERE complaint_id = $1::bigint
           AND muted_at IS NULL
           AND (
             level = 'full'
             OR ($2::boolean AND level = 'basic')
           )`,
        [complaintId, notifyBasic]
    );

    return rows.map((r) => r.user_id);
}

async function notifyStatusChange(pool, complaintId, fromStatus, toStatus, actorId = null) {
    if (fromStatus === toStatus) return [];

    const userIds = await getWatchersForStatusNotify(pool, complaintId, fromStatus, toStatus);
    if (userIds.length === 0) return [];

    const label = citizenStatusLabel(toStatus);
    const body = statusChangeDescription(fromStatus, toStatus);
    const payload = {
        complaint_id: String(complaintId),
        from_status: fromStatus,
        to_status: toStatus,
        title: `Ocorrência ${label.toLowerCase()}`,
        body,
    };

    for (const userId of userIds) {
        await pool.query(
            `INSERT INTO notifications (user_id, actor_id, type, reference_type, reference_id, payload)
             VALUES ($1, $2, 'complaint_status', 'complaint', $3, $4::jsonb)`,
            [userId, actorId, String(complaintId), JSON.stringify(payload)]
        ).catch((err) => console.error('[watch:notify]', err.message));
    }

    return userIds;
}

module.exports = {
    upsertWatch,
    getWatch,
    syncWatchFromCreate,
    syncWatchFromLike,
    syncWatchFromWitness,
    setMuted,
    setManualLevel,
    removeWatchIfAllowed,
    getWatchersForStatusNotify,
    notifyStatusChange,
};
