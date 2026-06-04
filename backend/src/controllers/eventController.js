const supabasePool = require('../infra/supabasePool');

exports.create = async (req, res) => {
    const { description, start_date, end_date, category, address, latitude, longitude } = req.body;
    const created_by = req.user.id; // Pega o userId do middleware de autenticação

    try {
        // Validação dos campos obrigatórios
        if (!description) {
            return res.status(400).json({ message: 'A descrição do evento é obrigatória.' });
        }

        if (!start_date) {
            return res.status(400).json({ message: 'A data de início do evento é obrigatória.' });
        }

        const pool = await supabasePool.getPgPool();

        // Inserir o evento na tabela
        // created_at será preenchido automaticamente pelo banco (default: now())
        const result = await pool.query(
            'INSERT INTO events (description, start_date, end_date, created_by, category, address, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [description, start_date, end_date || null, created_by, category || null, address || null, latitude || null, longitude || null]
        );

        res.status(201).json({
            message: 'Evento criado com sucesso',
            event: {
                id: result.rows[0].id,
                description: result.rows[0].description,
                start_date: result.rows[0].start_date,
                end_date: result.rows[0].end_date,
                created_by: result.rows[0].created_by,
                created_at: result.rows[0].created_at,
                category: result.rows[0].category,
                address: result.rows[0].address,
                latitude: result.rows[0].latitude,
                longitude: result.rows[0].longitude,
            }
        });
    } catch (error) {
        console.error('Erro ao criar evento:', error);
        res.status(500).json({ message: 'Erro ao criar evento.' });
    }
};

exports.getAll = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();

        // Buscar todos os eventos com informações do criador
        const result = await pool.query(`
            SELECT 
                e.id,
                e.description,
                e.start_date,
                e.end_date,
                e.category,
                e.address,
                e.latitude,
                e.longitude,
                e.created_at,
                e.created_by,
                u.name as created_by_name,
                u.email as created_by_email
            FROM events e
            LEFT JOIN users u ON e.created_by = u.id
            ORDER BY e.start_date ASC
        `);

        res.status(200).json({
            events: result.rows
        });
    } catch (error) {
        console.error('Erro ao buscar eventos:', error);
        res.status(500).json({ message: 'Erro ao buscar eventos.' });
    }
};

exports.delete = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const pool = await supabasePool.getPgPool();

        // Verificar se o evento existe e se o usuário é o dono
        const eventResult = await pool.query(
            'SELECT id, created_by FROM events WHERE id = $1',
            [id]
        );

        if (eventResult.rows.length === 0) {
            return res.status(404).json({ message: 'Evento não encontrado.' });
        }

        const event = eventResult.rows[0];

        // Verificar se o usuário é o dono
        if (event.created_by !== userId) {
            return res.status(403).json({ message: 'Você não tem permissão para excluir este evento.' });
        }

        // Deletar o evento do banco
        await pool.query('DELETE FROM events WHERE id = $1', [id]);

        res.status(200).json({
            message: 'Evento excluído com sucesso'
        });
    } catch (error) {
        console.error('Erro ao excluir evento:', error);
        res.status(500).json({ message: 'Erro ao excluir evento.' });
    }
};

