const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        console.warn(`[auth] 401 - Token ausente: ${req.method} ${req.path}`);
        return res.status(401).json({ message: 'Token de acesso não fornecido.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.warn(`[auth] 403 - Token inválido: ${err.message}`);
            return res.status(403).json({ message: 'Token inválido ou expirado.' });
        }

        req.user = { id: decoded.userId };
        next();
    });
};

const optionalAuth = (req, _res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return next();
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (!err && decoded) req.user = { id: decoded.userId };
        next();
    });
};

module.exports = { authenticateToken, optionalAuth };

