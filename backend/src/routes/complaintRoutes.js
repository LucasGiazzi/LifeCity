const express = require('express');
const multer = require('multer');
const router = express.Router();

const complaintController = require('../controllers/complaintController');
const commentController = require('../controllers/commentController');
const likeController = require('../controllers/likeController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Configurar multer para upload de múltiplos arquivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB por arquivo
  },
  fileFilter: (req, file, cb) => {
    // Aceita apenas imagens
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'), false);
    }
  },
});

// Rota pública para buscar todas as reclamações
router.get('/', complaintController.getAll);

// Rota pública: destaques por engajamento
router.get('/highlights', complaintController.getHighlights);

// Rota autenticada: interações do usuário logado
router.get('/me/interactions', authenticateToken, complaintController.getMyInteractions);

// Rota autenticada: interações de outro usuário (perfil de amigo)
router.get('/users/:userId/interactions', authenticateToken, complaintController.getUserInteractions);

// Rota pública para buscar fotos de uma reclamação
router.get('/:id/photos', complaintController.getPhotos);

// Rotas que exigem autenticação
router.post('/create', authenticateToken, upload.array('photos', 10), complaintController.create);
router.put('/:id', authenticateToken, complaintController.update);
router.delete('/:id', authenticateToken, complaintController.delete);

// Comment routes
router.get('/:id/comments', commentController.getComments);
router.post('/:id/comments', authenticateToken, commentController.addComment);
router.post('/:id/comments/:commentId/like', authenticateToken, commentController.toggleCommentLike);

// Like routes
router.get('/:id/likes', likeController.getStatus);
router.post('/:id/like', authenticateToken, likeController.toggle);

module.exports = router;

