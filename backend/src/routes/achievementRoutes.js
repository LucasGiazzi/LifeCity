const express = require('express');
const router = express.Router();
const achievementController = require('../controllers/achievementController');
const { authenticateToken, optionalAuth } = require('../middleware/authMiddleware');

router.get('/', optionalAuth, achievementController.getCatalog);
router.get('/me', authenticateToken, achievementController.getMyAchievements);
router.get('/users/:userId', achievementController.getUserFeatured);
router.patch('/me/featured', authenticateToken, achievementController.setFeatured);

module.exports = router;
