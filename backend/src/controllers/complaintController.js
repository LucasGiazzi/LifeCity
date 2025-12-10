const supabasePool = require('../infra/supabasePool');

exports.create = async (req, res) => {
    const { description, occurrence_date, address, latitude, longitude, type } = req.body;
    const created_by = req.user.id; // Pega o userId do middleware de autenticação

    try {
        // Validação dos campos obrigatórios
        if (!description) {
            return res.status(400).json({ message: 'A descrição da reclamação é obrigatória.' });
        }

        if (!occurrence_date) {
            return res.status(400).json({ message: 'A data de ocorrência é obrigatória.' });
        }

        const pool = await supabasePool.getPgPool();

        // Inserir a reclamação na tabela
        // created_at será preenchido automaticamente pelo banco (default: now())
        const result = await pool.query(
            'INSERT INTO complaints (description, occurrence_date, created_by, category, address, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [description, occurrence_date, created_by, type || null, address || null, latitude || null, longitude || null]
        );

        res.status(201).json({
            message: 'Reclamação criada com sucesso',
            complaint: {
                id: result.rows[0].id,
                description: result.rows[0].description,
                occurrence_date: result.rows[0].occurrence_date,
                created_by: result.rows[0].created_by,
                created_at: result.rows[0].created_at,
                type: result.rows[0].type,
                address: result.rows[0].address,
                latitude: result.rows[0].latitude,
                longitude: result.rows[0].longitude,
            }
        });
    } catch (error) {
        console.error('Erro ao criar reclamação:', error);
        res.status(500).json({ message: 'Erro ao criar reclamação.' });
    }
};

exports.getAll = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();

        // Buscar todas as reclamações com informações do criador
        const result = await pool.query(`
            SELECT 
                c.id,
                c.description,
                c.occurrence_date,
                c.category,
                c.address,
                c.latitude,
                c.longitude,
                c.created_at,
                u.name as created_by_name,
                u.email as created_by_email
            FROM complaints c
            LEFT JOIN users u ON c.created_by = u.id
            ORDER BY c.occurrence_date DESC, c.created_at DESC
        `);

        res.status(200).json({
            complaints: result.rows
        });
    } catch (error) {
        console.error('Erro ao buscar reclamações:', error);
        res.status(500).json({ message: 'Erro ao buscar reclamações.' });
    }
};

