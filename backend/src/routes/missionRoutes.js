const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/missionController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Equipes — registradas ANTES de /:id para evitar conflito de rota
router.get('/teams',          authenticateToken, ctrl.getTeams);
router.post('/teams',         authenticateToken, ctrl.createTeam);
router.get('/teams/:id',      authenticateToken, ctrl.getTeamById);
router.post('/teams/:id/invite',  authenticateToken, ctrl.inviteToTeam);
router.post('/teams/:id/accept',  authenticateToken, ctrl.acceptTeamInvite);
router.post('/teams/:id/reject',  authenticateToken, ctrl.rejectTeamInvite);

// Missões automáticas
router.get('/',    authenticateToken, ctrl.getMyMissions);
router.get('/:id', authenticateToken, ctrl.getMissionById);

module.exports = router;
