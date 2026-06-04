const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Token de acesso não fornecido.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Token inválido ou expirado.' });
        }

        req.user = {
            id: decoded.userId,
            tenantId: decoded.tenantId,
            cd_mun: decoded.cd_mun,
            tenantRole: decoded.tenantRole,
        };
        next();
    });
};

module.exports = { authenticateToken };

