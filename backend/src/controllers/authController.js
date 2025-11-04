const supabasePool = require('../infra/supabasePool');
const { encryptPassword, generateSalt } = require('../infra/crypto');
const { uploadPublicFile, deletePublicFile } = require('../infra/supabaseStorageClient');

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const pool = await supabasePool.getPgPool();

        const { rows: user } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (user.length === 0) {
            return res.status(401).json({ message: 'Email ou senha inválidos.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user[0].password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Email ou senha inválidos.' });
        }

        const accessToken = jwt.sign({ userId: user[0].id }, process.env.JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ userId: user[0].id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

        res.status(200).json({ message: 'Login bem sucedido', user: {
            id: user[0].id,
            email: user[0].email,
            name: user[0].name,
            phone: user[0].phone,
            cpf: user[0].cpf,
            photo_url: user[0].photo_url,
        }, accessToken, refreshToken });
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({ message: 'Erro ao fazer login.' });
    }

}

exports.refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    try {
    
        if (!refreshToken) {
            return res.status(401).json({ message: 'Token de refresh não encontrado.' });
        }
    
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
        if (!decoded) {
            return res.status(401).json({ message: 'Token de refresh inválido.' });
        }
    
        const accessToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
    
        res.status(200).json({ message: 'Token de acesso atualizado', accessToken });

    } catch (error) {
        console.error('Erro ao atualizar token de acesso:', error);
        res.status(500).json({ message: 'Erro ao atualizar token de acesso.' });
    }
}

exports.logout = async (req, res) => {
    const { refreshToken } = req.body;

    try {

        if (!refreshToken) {
            return res.status(401).json({ message: 'Token de refresh não encontrado.' });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

        if (!decoded) {
            return res.status(401).json({ message: 'Token de refresh inválido.' });
        }

        const pool = await supabasePool.getPgPool();

        await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [decoded.userId]);

        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        res.status(500).json({ message: 'Erro ao fazer logout.' });
    }
}

exports.register = async (req, res) => {
    const { email, password, name, cpf, phone } = req.body;

    try {

        const pool = await supabasePool.getPgPool();

        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (user.rows.length > 0) {
            return res.status(400).json({ message: 'Email já está cadastrado.' });
        }

        const salt = generateSalt();
        const hashedPassword = encryptPassword(password, salt);

        await pool.query('INSERT INTO users (email, password, name, phone, salt) VALUES ($1, $2, $3, $4, $5)', [email, hashedPassword, name, phone, salt]);

        res.status(200).json({ message: 'Register successful' });
    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({ message: 'Erro ao registrar usuário.' });
    }

}

exports.editUser = async (req, res) => {
    const { email, name, phone, cpf, birthDate } = req.body;
    const pfp = req.file;

    try {

        const pool = await supabasePool.getPgPool();

        // Buscar o usuário
        const user = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);

        // Verificar se o usuário existe
        if (user.rows.length === 0) {
            return res.status(400).json({ message: 'Usuário não encontrado.' });
        }

        // Atualizar o usuário sem o pfp
        await pool.query('UPDATE users SET name = $1, phone = $2, cpf = $3, birth_date = $4 WHERE id = $5', [name, phone, cpf, birthDate, req.user.id]);

        if (pfp) {
            // Upload do novo pfp
            const { path, publicUrl } = await uploadPublicFile({ bucket: 'profile_pictures', path: `${req.user.id}/pfp.png`, file: pfp });
            
            // Deletar o arquivo antigo
            if (user.rows[0].photo_path) {
                await deletePublicFile({ bucket: 'profile_pictures', path: user.rows[0].photo_path });
            }

            // Atualizar o usuário com o novo pfp
            await pool.query('UPDATE users SET photo_url = $1, photo_path = $2 WHERE id = $3', [publicUrl, path, req.user.id]);

        }

        res.status(200).json({ message: 'Usuário editado com sucesso' });

    } catch (error) {
        console.error('Erro ao editar usuário:', error);
        res.status(500).json({ message: 'Erro ao editar usuário.' });
    }
}
