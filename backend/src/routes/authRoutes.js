const express = require('express');
const multer = require('multer');
const router = express.Router();

const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Configurar multer para upload de arquivos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
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

router.post('/register', authController.register);

router.post('/login', authController.login);

router.post('/refreshToken', authController.refreshToken);

router.post('/logout', authController.logout);

router.get('/me', authenticateToken, authController.getMe);

router.post('/resolve-location', authenticateToken, authController.resolveLocation);

router.post('/confirm-location', authenticateToken, authController.confirmLocation);

router.put('/editUser', authenticateToken, upload.single('pfp'), authController.editUser);

router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-code', authController.verifyResetCode);
router.post('/reset-password', authController.resetPassword);

router.get('/invite-info', authController.inviteInfo);
router.post('/accept-invite', authController.acceptInvite);

module.exports = router;