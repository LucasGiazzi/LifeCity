const crypto = require('crypto');
const supabasePool = require('../infra/supabasePool');
const { encryptPassword, generateSalt } = require('../infra/crypto');
const { uploadPublicFile, deletePublicFile } = require('../infra/supabaseStorageClient');
const {
    getActiveTenantsForUser,
    getMembership,
    buildAccessToken,
    buildRefreshToken,
} = require('../services/tenantService');
const { isValidCpf } = require('../infra/cpfValidator');
const { isValidCityCep } = require('../infra/cityValidator');
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
            return res.status(401).json({ message: 'Email ou senha inv?lidos.' });
        }
                
        if (!isPasswordValid(password, user[0])) {
            console.log('Senha inv?lida');
            return res.status(401).json({ message: 'Email ou senha inv?lidos.' });
        }
        
        const userLevel = Number(user[0].user_level ?? 1);
        const tenants = await getActiveTenantsForUser(pool, user[0].id);
        const activeTenant = tenants.length > 0 ? tenants[0] : null;
        const activeTenantId = activeTenant?.id ?? null;

        const accessToken = buildAccessToken(user[0].id, activeTenant);
        const refreshToken = buildRefreshToken(user[0].id, activeTenantId);

        const response = {
            message: 'Login bem sucedido',
            user: {
                id: user[0].id,
                email: user[0].email,
                name: user[0].name,
                phone: user[0].phone,
                cpf: user[0].cpf,
                photo_url: user[0].photo_url,
                user_level: userLevel,
            },
            accessToken,
            refreshToken,
            tenants,
        };

        if (activeTenantId) {
            response.activeTenantId = activeTenantId;
        }

        res.status(200).json(response);
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({ message: 'Erro ao fazer login.' });
    }

}

exports.refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    try {
    
        if (!refreshToken) {
            return res.status(401).json({ message: 'Token de refresh n?o encontrado.' });
        }
    
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
        if (!decoded) {
            return res.status(401).json({ message: 'Token de refresh inv?lido.' });
        }
    
        let activeTenant = null;
        if (decoded.tenantId) {
            const pool = await supabasePool.getPgPool();
            activeTenant = await getMembership(pool, decoded.userId, decoded.tenantId);
        }

        const accessToken = buildAccessToken(decoded.userId, activeTenant);

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
            return res.status(401).json({ message: 'Token de refresh n?o encontrado.' });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

        if (!decoded) {
            return res.status(401).json({ message: 'Token de refresh inv?lido.' });
        }

        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        res.status(500).json({ message: 'Erro ao fazer logout.' });
    }
}

exports.register = async (req, res) => {
    const { email, password, name, cpf, phone, cep } = req.body;

    try {

        const pool = await supabasePool.getPgPool();

        if (!isValidCpf(cpf)) {
            return res.status(400).json({ message: 'CPF inválido.' });
        }

        if (cep && !isValidCityCep(cep)) {
            return res.status(400).json({ message: 'CEP não pertence à cidade atendida pelo LifeCity.' });
        }

        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (user.rows.length > 0) {
            return res.status(400).json({ message: 'Email j? est? cadastrado.' });
        }

        const existingCpf = await pool.query('SELECT id FROM users WHERE cpf = $1', [cpf.replace(/\D/g, '')]);

        if (existingCpf.rows.length > 0) {
            return res.status(400).json({ message: 'CPF já está cadastrado.' });
        }

        const salt = generateSalt();
        const hashedPassword = encryptPassword(password, salt);
        const cleanCep = cep ? cep.replace(/\D/g, '') : null;

        await pool.query(
            'INSERT INTO users (email, password, name, cpf, phone, salt, cep) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [email, hashedPassword, name, cpf.replace(/\D/g, ''), phone, salt, cleanCep]
        );

        return res.status(200).json({
            message: 'Registrado com sucesso',
            requiresLocationConfirmation: true,
        });
    } catch (error) {
        console.error('Erro ao registrar usu?rio:', error);
        return res.status(500).json({ message: 'Erro ao registrar usu?rio. Tente novamente.' });
    }
}

const USER_SELECT_WITH_MUNICIPIO = `
    SELECT u.id, u.email, u.name, u.phone, u.cpf, u.photo_url, u.birth_date,
           COALESCE(u.user_level, 1) AS user_level,
           u.home_cd_mun, u.registration_address, u.address_confirmed_at,
           m.nm_mun AS municipio_nome
    FROM users u
    LEFT JOIN malhas.municipios m ON m.cd_mun = u.home_cd_mun
    WHERE u.id = $1
`;

const RESOLVE_MUNICIPIO_SQL = `
    SELECT m.cd_mun, m.nm_mun, m.sigla_uf,
           EXISTS(
               SELECT 1 FROM tenants t
               WHERE t.cd_mun = m.cd_mun AND t.status IN ('trial', 'active')
           ) AS tenant_active
    FROM malhas.municipios m
    WHERE ST_Contains(m.geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326))
    LIMIT 1
`;

exports.resolveLocation = async (req, res) => {
    const latitude = Number(req.body?.latitude);
    const longitude = Number(req.body?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return res.status(400).json({ message: 'Latitude e longitude são obrigatórias.' });
    }

    try {
        const pool = await supabasePool.getPgPool();
        const { rows } = await pool.query(RESOLVE_MUNICIPIO_SQL, [longitude, latitude]);

        if (rows.length === 0) {
            return res.status(404).json({
                message: 'Não identificamos sua cidade. Verifique se a localização está ativa.',
            });
        }

        const row = rows[0];
        if (!row.tenant_active) {
            return res.status(403).json({
                message: 'LifeCity ainda não está disponível em sua cidade.',
            });
        }

        return res.status(200).json({
            cd_mun: row.cd_mun,
            municipio: row.nm_mun,
            sigla_uf: row.sigla_uf,
            tenantActive: true,
            suggestedAddress: null,
        });
    } catch (error) {
        console.error('Erro ao resolver localização:', error);
        return res.status(500).json({ message: 'Erro ao resolver localização.' });
    }
};

exports.confirmLocation = async (req, res) => {
    const { cd_mun, address, latitude, longitude } = req.body ?? {};
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!cd_mun || !address || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({
            message: 'cd_mun, address, latitude e longitude são obrigatórios.',
        });
    }

    try {
        const pool = await supabasePool.getPgPool();

        const { rows: existing } = await pool.query(
            'SELECT address_confirmed_at, home_cd_mun, registration_address FROM users WHERE id = $1',
            [req.user.id],
        );

        if (existing.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        if (existing[0].address_confirmed_at) {
            const { rows: userRows } = await pool.query(USER_SELECT_WITH_MUNICIPIO, [req.user.id]);
            const u = userRows[0];
            return res.status(200).json({
                message: 'Localização confirmada',
                user: {
                    home_cd_mun: u.home_cd_mun,
                    municipio: u.municipio_nome,
                    address_confirmed_at: u.address_confirmed_at,
                },
            });
        }

        const { rows: resolved } = await pool.query(RESOLVE_MUNICIPIO_SQL, [lng, lat]);

        if (resolved.length === 0) {
            return res.status(404).json({
                message: 'Não identificamos sua cidade. Verifique se a localização está ativa.',
            });
        }

        const match = resolved[0];
        if (String(match.cd_mun).trim() !== String(cd_mun).trim()) {
            return res.status(400).json({ message: 'Município não corresponde à localização informada.' });
        }

        if (!match.tenant_active) {
            return res.status(403).json({
                message: 'LifeCity ainda não está disponível em sua cidade.',
            });
        }

        await pool.query(
            `UPDATE users
             SET home_cd_mun = $1,
                 registration_address = $2,
                 address_confirmed_at = NOW()
             WHERE id = $3`,
            [cd_mun, address, req.user.id],
        );

        const { rows: userRows } = await pool.query(USER_SELECT_WITH_MUNICIPIO, [req.user.id]);
        const u = userRows[0];

        return res.status(200).json({
            message: 'Localização confirmada',
            user: {
                home_cd_mun: u.home_cd_mun,
                municipio: u.municipio_nome,
                address_confirmed_at: u.address_confirmed_at,
            },
        });
    } catch (error) {
        console.error('Erro ao confirmar localização:', error);
        return res.status(500).json({ message: 'Erro ao confirmar localização.' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const pool = await supabasePool.getPgPool();
        
        const { rows: user } = await pool.query(USER_SELECT_WITH_MUNICIPIO, [req.user.id]);
        
        if (user.length === 0) {
            return res.status(404).json({ message: 'Usu?rio n?o encontrado.' });
        }

        res.status(200).json({
            user: user[0]
        });
    } catch (error) {
        console.error('Erro ao buscar usu?rio:', error);
        res.status(500).json({ message: 'Erro ao buscar dados do usu?rio.' });
    }
};

exports.editUser = async (req, res) => {
    const { name, phone, cpf, birthDate } = req.body;
    const pfp = req.file;

    try {

        const pool = await supabasePool.getPgPool();

        // Buscar o usu?rio
        const user = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);

        // Verificar se o usu?rio existe
        if (user.rows.length === 0) {
            return res.status(400).json({ message: 'Usu?rio n?o encontrado.' });
        }

        // Atualizar o usu?rio sem o pfp
        await pool.query('UPDATE users SET name = $1, phone = $2, cpf = $3, birth_date = $4 WHERE id = $5', [name, phone, cpf, birthDate, req.user.id]);
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

            // Atualizar o usu?rio com o novo pfp
            await pool.query('UPDATE users SET photo_url = $1, photo_path = $2 WHERE id = $3', [publicUrl, path, req.user.id]);

        }

        // Buscar dados atualizados do usu?rio
        const { rows: updatedUser } = await pool.query('SELECT id, email, name, phone, cpf, photo_url, birth_date FROM users WHERE id = $1', [req.user.id]);

        res.status(200).json({
            message: 'Usuário editado com sucesso',
            user: updatedUser[0]
        });

    } catch (error) {
        console.error('Erro ao editar usuário:', error);
        res.status(500).json({ message: 'Erro ao editar usu?rio.', error: error.message });
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
