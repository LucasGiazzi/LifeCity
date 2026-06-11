const pushNotificationService = require('../services/pushNotificationService');

exports.register = async (req, res) => {
    const { token, platform, app_version: appVersion } = req.body ?? {};

    if (!token || !platform) {
        return res.status(400).json({ message: 'token e platform são obrigatórios.' });
    }
    if (!['android', 'ios'].includes(platform)) {
        return res.status(400).json({ message: 'platform deve ser android ou ios.' });
    }

    try {
        await pushNotificationService.registerToken(req.user.id, token, platform, appVersion);
        res.status(200).json({ message: 'Token registrado.' });
    } catch (error) {
        console.error('Erro ao registrar token:', error);
        res.status(500).json({ message: 'Erro ao registrar token.' });
    }
};

exports.unregister = async (req, res) => {
    const { token } = req.body ?? {};
    if (!token) {
        return res.status(400).json({ message: 'token é obrigatório.' });
    }

    try {
        await pushNotificationService.unregisterToken(req.user.id, token);
        res.status(200).json({ message: 'Token removido.' });
    } catch (error) {
        console.error('Erro ao remover token:', error);
        res.status(500).json({ message: 'Erro ao remover token.' });
    }
};
