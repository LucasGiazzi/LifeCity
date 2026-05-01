const express = require('express');
const multer = require('multer');
const router = express.Router();

const complaintController = require('../controllers/complaintController');
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

// Rota pública para buscar fotos de uma reclamação
router.get('/:id/photos', complaintController.getPhotos);

// Rotas que exigem autenticação
router.post('/create', authenticateToken, upload.array('photos', 10), complaintController.create);
router.delete('/:id', authenticateToken, complaintController.delete);

module.exports = router;

