const express = require('express');
const router = express.Router();

const eventController = require('../controllers/eventController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Rota pública para buscar todos os eventos
router.get('/', eventController.getAll);

// Rotas que exigem autenticação
router.post('/create', authenticateToken, eventController.create);
router.delete('/:id', authenticateToken, eventController.delete);

module.exports = router;

