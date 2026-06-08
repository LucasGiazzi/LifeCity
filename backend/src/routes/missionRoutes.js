const express = require('express');
const multer = require('multer');
const router = express.Router();
const ctrl = require('../controllers/missionController');
const { authenticateToken } = require('../middleware/authMiddleware');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        file.mimetype.startsWith('image/')
            ? cb(null, true)
            : cb(new Error('Apenas imagens são permitidas'), false);
    },
});

// Equipes — registradas ANTES de /:id para evitar conflito de rota
router.get('/teams',          authenticateToken, ctrl.getTeams);
router.post('/teams',         authenticateToken, ctrl.createTeam);
router.get('/teams/:id',      authenticateToken, ctrl.getTeamById);
router.put('/teams/:id',      authenticateToken, upload.single('photo'), ctrl.editTeam);
router.post('/teams/:id/invite',  authenticateToken, ctrl.inviteToTeam);
router.post('/teams/:id/accept',  authenticateToken, ctrl.acceptTeamInvite);
router.post('/teams/:id/reject',  authenticateToken, ctrl.rejectTeamInvite);
router.get('/teams/:id/messages', authenticateToken, ctrl.getTeamMessages);
router.post('/teams/:id/messages', authenticateToken, ctrl.sendTeamMessage);

// Missões automáticas
router.get('/',    authenticateToken, ctrl.getMyMissions);
router.get('/:id', authenticateToken, ctrl.getMissionById);

module.exports = router;
