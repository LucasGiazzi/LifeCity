const express = require('express');
const router = express.Router();

const complaintController = require('../controllers/complaintController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Rota pública para buscar todas as reclamações
router.get('/', complaintController.getAll);

// Rotas que exigem autenticação
router.post('/create', authenticateToken, complaintController.create);

module.exports = router;

