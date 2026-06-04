const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/authMiddleware');
const { requireTenantMember } = require('../middleware/requireTenantMember');
const tenantController = require('../controllers/admin/tenantController');
const malhasController = require('../controllers/admin/malhasController');
const adminComplaintsController = require('../controllers/admin/adminComplaintsController');
const analyticsController = require('../controllers/admin/analyticsController');
const categoriesController = require('../controllers/categoriesController');

router.get('/tenants/mine', authenticateToken, tenantController.listMine);
router.post('/tenants/switch', authenticateToken, tenantController.switchTenant);

router.use(authenticateToken, requireTenantMember);

router.get('/malhas/municipio', malhasController.getMunicipio);
router.get('/malhas/bairros', malhasController.getBairros);
router.get('/malhas/setores', malhasController.getSetores);
router.get('/complaints', adminComplaintsController.list);
router.get('/complaints/:id', adminComplaintsController.getById);
router.get('/categories', categoriesController.list);
router.get('/analytics/summary', analyticsController.summary);
router.get('/analytics/by-category', analyticsController.byCategory);
router.get('/analytics/ranking-areas', analyticsController.rankingAreas);

module.exports = router;
