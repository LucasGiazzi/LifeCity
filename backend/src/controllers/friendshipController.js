const supabasePool = require('../infra/supabasePool');

async function emitNotification(pool, userId, actorId, type, referenceType, referenceId) {
    pool.query(
        `INSERT INTO notifications (user_id, actor_id, type, reference_type, reference_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, actorId, type, referenceType, referenceId]
    ).catch(err => console.error('[notification:friendship]', err.message));
}

/** Lista utilizadores (sem credenciais) com estado de amizade em relação ao utilizador autenticado. */
exports.discover = async (req, res) => {
  const me = req.user.id;
  try {
    const pool = await supabasePool.getPgPool();
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.photo_url,
        fr.id AS friendship_id,
        fr.status AS friendship_status,
        CASE
          WHEN fr.requester_id = $1::uuid THEN 'outgoing'
          WHEN fr.addressee_id = $1::uuid THEN 'incoming'
        END AS direction
      FROM users u
      LEFT JOIN LATERAL (
        SELECT f.*
        FROM friendships f
        WHERE (f.requester_id = $1::uuid AND f.addressee_id = u.id)
           OR (f.addressee_id = $1::uuid AND f.requester_id = u.id)
        AND f.status IN ('pending', 'accepted')
        ORDER BY
          CASE WHEN f.status = 'pending' THEN 0 ELSE 1 END,
          f.created_at DESC
        LIMIT 1
      ) fr ON true
      WHERE u.id <> $1::uuid
      ORDER BY u.name ASC`,
      [me],
    );
    const users = rows.map((row) => ({
      id: row.id,
      name: row.name,
      photo_url: row.photo_url,
      friendship_id: row.friendship_id,
      friendship_status: row.friendship_status,
      direction: row.direction,
    }));
    res.json({ users });
  } catch (error) {
    console.error('Erro em friendships.discover:', error);
    res.status(500).json({ message: 'Erro ao listar utilizadores.' });
  }
};

/** Pedidos recebidos (pendentes). */
exports.listIncoming = async (req, res) => {
  const me = req.user.id;
  try {
    const pool = await supabasePool.getPgPool();
    const { rows } = await pool.query(
      `SELECT f.id, f.created_at, f.requester_id, u.name, u.photo_url
       FROM friendships f
       JOIN users u ON u.id = f.requester_id
       WHERE f.addressee_id = $1::uuid AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [me],
    );
    res.json({ requests: rows });
  } catch (error) {
    console.error('Erro em friendships.listIncoming:', error);
    res.status(500).json({ message: 'Erro ao listar pedidos recebidos.' });
  }
};

/** Pedidos enviados (pendentes). */
exports.listOutgoing = async (req, res) => {
  const me = req.user.id;
  try {
    const pool = await supabasePool.getPgPool();
    const { rows } = await pool.query(
      `SELECT f.id, f.created_at, f.addressee_id, u.name, u.photo_url
       FROM friendships f
       JOIN users u ON u.id = f.addressee_id
       WHERE f.requester_id = $1::uuid AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [me],
    );
    res.json({ requests: rows });
  } catch (error) {
    console.error('Erro em friendships.listOutgoing:', error);
    res.status(500).json({ message: 'Erro ao listar pedidos enviados.' });
  }
};

/** Amigos aceites. */
exports.listFriends = async (req, res) => {
  const me = req.user.id;
  try {
    const pool = await supabasePool.getPgPool();
    const { rows } = await pool.query(
      `SELECT f.id AS friendship_id, f.created_at,
        CASE WHEN f.requester_id = $1::uuid THEN f.addressee_id ELSE f.requester_id END AS friend_id,
        u.name, u.photo_url
       FROM friendships f
       JOIN users u ON u.id = (
         CASE WHEN f.requester_id = $1::uuid THEN f.addressee_id ELSE f.requester_id END
       )
       WHERE (f.requester_id = $1::uuid OR f.addressee_id = $1::uuid) AND f.status = 'accepted'
       ORDER BY u.name ASC`,
      [me],
    );
    res.json({ friends: rows });
  } catch (error) {
    console.error('Erro em friendships.listFriends:', error);
    res.status(500).json({ message: 'Erro ao listar amigos.' });
  }
};

/** Envia pedido de amizade para userId. */
exports.sendRequest = async (req, res) => {
  const me = req.user.id;
  const { userId } = req.body;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ message: 'Identificador do utilizador em falta.' });
  }
  if (userId === me) {
    return res.status(400).json({ message: 'Não pode enviar pedido a si próprio.' });
  }

  try {
    const pool = await supabasePool.getPgPool();

    const target = await pool.query('SELECT id FROM users WHERE id = $1::uuid', [userId]);
    if (target.rows.length === 0) {
      return res.status(404).json({ message: 'Utilizador não encontrado.' });
    }

    const direct = await pool.query(
      'SELECT * FROM friendships WHERE requester_id = $1::uuid AND addressee_id = $2::uuid',
      [me, userId],
    );
    if (direct.rows.length > 0) {
      const row = direct.rows[0];
      if (row.status === 'accepted') {
        return res.status(400).json({ message: 'Já são amigos.' });
      }
      if (row.status === 'pending') {
        return res.status(400).json({ message: 'Já enviou um pedido a este utilizador.' });
      }
      if (row.status === 'rejected') {
        const upd = await pool.query(
          `UPDATE friendships
           SET status = 'pending', responded_at = NULL, created_at = now()
           WHERE id = $1
           RETURNING *`,
          [row.id],
        );
        res.status(201).json({
          message: 'Pedido reenviado.',
          friendship: upd.rows[0],
        });
        emitNotification(pool, userId, me, 'friend_request', 'friendship', upd.rows[0].id.toString());
        return;
      }
    }

    const reverse = await pool.query(
      'SELECT * FROM friendships WHERE requester_id = $1::uuid AND addressee_id = $2::uuid',
      [userId, me],
    );
    if (reverse.rows.length > 0) {
      const row = reverse.rows[0];
      if (row.status === 'accepted') {
        return res.status(400).json({ message: 'Já são amigos.' });
      }
      if (row.status === 'pending') {
        return res.status(409).json({
          message: 'Este utilizador já lhe enviou um pedido. Aceite ou recuse no separador Pedidos.',
          incoming_friendship_id: row.id,
        });
      }
    }

    const ins = await pool.query(
      `INSERT INTO friendships (requester_id, addressee_id, status)
       VALUES ($1::uuid, $2::uuid, 'pending')
       RETURNING *`,
      [me, userId],
    );
    res.status(201).json({
      message: 'Pedido enviado.',
      friendship: ins.rows[0],
    });
    emitNotification(pool, userId, me, 'friend_request', 'friendship', ins.rows[0].id.toString());
  } catch (error) {
    console.error('Erro em friendships.sendRequest:', error);
    if (error.code === '23505') {
      return res.status(400).json({ message: 'Relação de amizade já existe.' });
    }
    res.status(500).json({ message: 'Erro ao enviar pedido.' });
  }
};

/** Aceita pedido (só o destinatário). */
exports.accept = async (req, res) => {
  const me = req.user.id;
  const { id } = req.params;
  const fid = parseInt(id, 10);
  if (!Number.isFinite(fid)) {
    return res.status(400).json({ message: 'Identificador inválido.' });
  }
  try {
    const pool = await supabasePool.getPgPool();
    const result = await pool.query(
      `UPDATE friendships
       SET status = 'accepted', responded_at = now()
       WHERE id = $1 AND addressee_id = $2::uuid AND status = 'pending'
       RETURNING *`,
      [fid, me],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Pedido não encontrado ou já tratado.' });
    }
    res.json({ message: 'Pedido aceite.', friendship: result.rows[0] });
  } catch (error) {
    console.error('Erro em friendships.accept:', error);
    res.status(500).json({ message: 'Erro ao aceitar pedido.' });
  }
};

/** Recusa pedido (só o destinatário). */
exports.reject = async (req, res) => {
  const me = req.user.id;
  const { id } = req.params;
  const fid = parseInt(id, 10);
  if (!Number.isFinite(fid)) {
    return res.status(400).json({ message: 'Identificador inválido.' });
  }
  try {
    const pool = await supabasePool.getPgPool();
    const result = await pool.query(
      `UPDATE friendships
       SET status = 'rejected', responded_at = now()
       WHERE id = $1 AND addressee_id = $2::uuid AND status = 'pending'
       RETURNING *`,
      [fid, me],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Pedido não encontrado ou já tratado.' });
    }
    res.json({ message: 'Pedido recusado.', friendship: result.rows[0] });
  } catch (error) {
    console.error('Erro em friendships.reject:', error);
    res.status(500).json({ message: 'Erro ao recusar pedido.' });
  }
};
