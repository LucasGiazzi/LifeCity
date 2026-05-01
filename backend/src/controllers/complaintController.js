const supabasePool = require('../infra/supabasePool');
const { uploadToSupabase, listBlobs, removeFolder } = require('../infra/supabaseStorageClient');

exports.create = async (req, res) => {
    const { description, occurrence_date, address, latitude, longitude, type } = req.body;
    const created_by = req.user.id; // Pega o userId do middleware de autenticação
    const photos = req.files || []; // Array de fotos do multer

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

        const complaintId = result.rows[0].id;

        // Fazer upload das fotos se houver
        if (photos.length > 0) {
            const uploadPromises = photos.map(async (photo, index) => {
                try {
                    const timestamp = Date.now();
                    const filename = `${timestamp}_${index}_${photo.originalname}`;
                    const path = `${complaintId}/${filename}`;
                    
                    await uploadToSupabase({
                        bucket: 'complaints',
                        path: path,
                        file: photo
                    });
                } catch (uploadError) {
                    // Loga o erro mas não falha a criação da reclamação
                    console.error(`Erro ao fazer upload da foto ${index}:`, uploadError);
                }
            });

            // Aguarda todos os uploads (mas não falha se algum der erro)
            await Promise.allSettled(uploadPromises);
        }

        res.status(201).json({
            message: 'Reclamação criada com sucesso',
            complaint: {
                id: result.rows[0].id,
                description: result.rows[0].description,
                occurrence_date: result.rows[0].occurrence_date,
                created_by: result.rows[0].created_by,
                created_at: result.rows[0].created_at,
                type: result.rows[0].category,
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
                c.category as type,
                c.address,
                c.latitude,
                c.longitude,
                c.created_at,
                c.created_by,
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

exports.getPhotos = async (req, res) => {
    const { id } = req.params;

    try {
        // Verificar se a reclamação existe
        const pool = await supabasePool.getPgPool();
        const complaintResult = await pool.query('SELECT id FROM complaints WHERE id = $1', [id]);

        if (complaintResult.rows.length === 0) {
            return res.status(404).json({ message: 'Reclamação não encontrada.' });
        }

        // Listar fotos da reclamação
        const photos = await listBlobs('complaints', id.toString(), 3600);

        res.status(200).json({
            photos: photos
        });
    } catch (error) {
        console.error('Erro ao buscar fotos da reclamação:', error);
        res.status(500).json({ message: 'Erro ao buscar fotos da reclamação.' });
    }
};

exports.delete = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const pool = await supabasePool.getPgPool();

        // Verificar se a reclamação existe e se o usuário é o dono
        const complaintResult = await pool.query(
            'SELECT id, created_by FROM complaints WHERE id = $1',
            [id]
        );

        if (complaintResult.rows.length === 0) {
            return res.status(404).json({ message: 'Reclamação não encontrada.' });
        }

        const complaint = complaintResult.rows[0];

        // Verificar se o usuário é o dono
        if (complaint.created_by !== userId) {
            return res.status(403).json({ message: 'Você não tem permissão para excluir esta reclamação.' });
        }

        // Remover pasta de fotos do storage
        try {
            await removeFolder('complaints', id.toString());
        } catch (folderError) {
            // Loga o erro mas continua com a exclusão
            console.error('Erro ao remover pasta de fotos:', folderError);
        }

        // Deletar a reclamação do banco
        await pool.query('DELETE FROM complaints WHERE id = $1', [id]);

        res.status(200).json({
            message: 'Reclamação excluída com sucesso'
        });
    } catch (error) {
        console.error('Erro ao excluir reclamação:', error);
        res.status(500).json({ message: 'Erro ao excluir reclamação.' });
    }
};

