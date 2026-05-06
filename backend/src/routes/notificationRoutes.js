const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, notificationController.list);
router.get('/unread-count', authenticateToken, notificationController.getUnreadCount);
router.patch('/read-all', authenticateToken, notificationController.markAllRead);
router.patch('/:id/read', authenticateToken, notificationController.markRead);

module.exports = router;
