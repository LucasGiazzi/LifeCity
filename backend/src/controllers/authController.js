const crypto = require('crypto');
const supabasePool = require('../infra/supabasePool');
const { encryptPassword, generateSalt } = require('../infra/crypto');
const { uploadPublicFile, deletePublicFile } = require('../infra/supabaseStorageClient');
const { isValidCpf } = require('../infra/cpfValidator');
const { sendPasswordResetEmail } = require('../infra/mailer');
const jwt = require('jsonwebtoken')

exports.login = async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const pool = await supabasePool.getPgPool();
        
        const { rows: user } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        function isPasswordValid(password, originalPassword) {
            return encryptPassword(password, originalPassword.salt) == originalPassword.password;
        }
        
        if (user.length === 0) {
            return res.status(401).json({ message: 'Email ou senha inválidos.' });
        }
                
        if (!isPasswordValid(password, user[0])) {
            console.log('Senha inválida');
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

        if (!isValidCpf(cpf)) {
            return res.status(400).json({ message: 'CPF inválido.' });
        }

        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (user.rows.length > 0) {
            return res.status(400).json({ message: 'Email já está cadastrado.' });
        }

        const existingCpf = await pool.query('SELECT id FROM users WHERE cpf = $1', [cpf.replace(/\D/g, '')]);

        if (existingCpf.rows.length > 0) {
            return res.status(400).json({ message: 'CPF já está cadastrado.' });
        }

        const salt = generateSalt();
        const hashedPassword = encryptPassword(password, salt);

        await pool.query('INSERT INTO users (email, password, name, cpf, phone, salt) VALUES ($1, $2, $3, $4, $5, $6)', [email, hashedPassword, name, cpf.replace(/\D/g, ''), phone, salt]);

        return res.status(200).json({ message: 'Registrado com sucesso' });
    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        return res.status(500).json({ message: 'Erro ao registrar usuário. Tente novamente.' });
    }
}

exports.getMe = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        
        const { rows: user } = await pool.query('SELECT id, email, name, phone, cpf, photo_url, birth_date FROM users WHERE id = $1', [req.user.id]);
        
        if (user.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        res.status(200).json({
            user: user[0]
        });
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ message: 'Erro ao buscar dados do usuário.' });
    }
};

exports.editUser = async (req, res) => {
    const { name, phone, cpf, birthDate } = req.body;
    const pfp = req.file;

    try {

        const pool = await supabasePool.getPgPool();

        // Buscar o usuário
        const user = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);

        // Verificar se o usuário existe
        if (user.rows.length === 0) {
            return res.status(400).json({ message: 'Usuário não encontrado.' });
        }

        const cleanCpf = cpf ? cpf.replace(/\D/g, '') : cpf;

        // Atualizar o usuário sem o pfp
        await pool.query('UPDATE users SET name = $1, phone = $2, cpf = $3, birth_date = $4 WHERE id = $5', [name, phone, cleanCpf, birthDate, req.user.id]);

        if (pfp) {
            // Deletar o arquivo antigo
            if (user.rows[0].photo_path) {
                await deletePublicFile({ bucket: 'pfp', path: user.rows[0].photo_path });
            }

            // Upload do novo pfp com nome único para evitar cache
            const { path, publicUrl } = await uploadPublicFile({ bucket: 'pfp', path: `${req.user.id}/pfp_${Date.now()}.png`, file: pfp });

            // Atualizar o usuário com o novo pfp
            await pool.query('UPDATE users SET photo_url = $1, photo_path = $2 WHERE id = $3', [publicUrl, path, req.user.id]);

        }

        // Buscar dados atualizados do usuário
        const { rows: updatedUser } = await pool.query('SELECT id, email, name, phone, cpf, photo_url, birth_date FROM users WHERE id = $1', [req.user.id]);

        res.status(200).json({
            message: 'Usuário editado com sucesso',
            user: updatedUser[0]
        });

    } catch (error) {
        console.error('Erro ao editar usuário:', error);
        res.status(500).json({ message: 'Erro ao editar usuário.', error: error.message });
    }
}

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'E-mail é obrigatório.' });

    const normalizedEmail = email.toLowerCase().trim();

    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);

        // Sempre retorna sucesso para não revelar quais e-mails estão cadastrados
        if (rows.length === 0) {
            return res.status(200).json({ message: 'Se esse e-mail estiver cadastrado, você receberá um código.' });
        }

        const userId = rows[0].id;
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const codeHash = crypto.createHash('sha256').update(code).digest('hex');

        await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
        await pool.query(
            `INSERT INTO password_reset_tokens (user_id, code_hash, expires_at)
             VALUES ($1, $2, NOW() + INTERVAL '15 minutes')`,
            [userId, codeHash]
        );

        await sendPasswordResetEmail(email, code);
        res.status(200).json({ message: 'Se esse e-mail estiver cadastrado, você receberá um código.' });
    } catch (error) {
        console.error('Erro ao enviar código:', error);
        res.status(500).json({ message: 'Erro ao enviar código de redefinição.' });
    }
};

exports.verifyResetCode = async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: 'Dados incompletos.' });

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCode = String(code).trim();

    try {
        const pool = await supabasePool.getPgPool();
        const { rows: users } = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Código inválido ou expirado.' });
        }

        const userId = users[0].id;
        const codeHash = crypto.createHash('sha256').update(normalizedCode).digest('hex');

        const { rows: tokens } = await pool.query(
            `SELECT id FROM password_reset_tokens
             WHERE user_id = $1 AND code_hash = $2 AND expires_at > NOW() AND used_at IS NULL`,
            [userId, codeHash]
        );

        if (tokens.length === 0) {
            return res.status(400).json({ message: 'Código inválido ou expirado.' });
        }

        res.status(200).json({ message: 'Código válido.' });
    } catch (error) {
        console.error('Erro ao verificar código:', error);
        res.status(500).json({ message: 'Erro ao verificar código.' });
    }
};

exports.resetPassword = async (req, res) => {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
        return res.status(400).json({ message: 'Dados incompletos.' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'A senha deve ter no mínimo 6 caracteres.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCode = String(code).trim();

    try {
        const pool = await supabasePool.getPgPool();
        const { rows: users } = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
        if (users.length === 0) {
            return res.status(400).json({ message: 'Código inválido ou expirado.' });
        }

        const userId = users[0].id;
        const codeHash = crypto.createHash('sha256').update(normalizedCode).digest('hex');

        const { rows: tokens } = await pool.query(
            `SELECT id FROM password_reset_tokens
             WHERE user_id = $1 AND code_hash = $2 AND expires_at > NOW() AND used_at IS NULL`,
            [userId, codeHash]
        );

        if (tokens.length === 0) {
            return res.status(400).json({ message: 'Código inválido ou expirado.' });
        }

        const salt = generateSalt();
        const hashedPassword = encryptPassword(newPassword, salt);

        await pool.query('UPDATE users SET password = $1, salt = $2 WHERE id = $3', [hashedPassword, salt, userId]);
        await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [tokens[0].id]);

        res.status(200).json({ message: 'Senha redefinida com sucesso.' });
    } catch (error) {
        console.error('Erro ao redefinir senha:', error);
        res.status(500).json({ message: 'Erro ao redefinir senha.' });
    }
};
