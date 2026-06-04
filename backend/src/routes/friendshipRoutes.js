const express = require('express');
const friendshipController = require('../controllers/friendshipController');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/discover', authenticateToken, friendshipController.discover);
router.get('/incoming', authenticateToken, friendshipController.listIncoming);
router.get('/outgoing', authenticateToken, friendshipController.listOutgoing);
router.get('/', authenticateToken, friendshipController.listFriends);
router.post('/request', authenticateToken, friendshipController.sendRequest);
router.post('/:id/accept', authenticateToken, friendshipController.accept);
router.post('/:id/reject', authenticateToken, friendshipController.reject);

module.exports = router;
