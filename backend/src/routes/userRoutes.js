const express = require('express');
const router = express.Router();
const deviceTokenController = require('../controllers/deviceTokenController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/device-token', authenticateToken, deviceTokenController.register);
router.delete('/device-token', authenticateToken, deviceTokenController.unregister);

module.exports = router;
