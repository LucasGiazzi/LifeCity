const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/authMiddleware');
const { requireTenantMember } = require('../middleware/requireTenantMember');
const { requireTenantRole } = require('../middleware/requireTenantRole');
const tenantController = require('../controllers/admin/tenantController');
const malhasController = require('../controllers/admin/malhasController');
const adminComplaintsController = require('../controllers/admin/adminComplaintsController');
const complaintMessageController = require('../controllers/complaintMessageController');
const analyticsController = require('../controllers/admin/analyticsController');
const opsTeamsController = require('../controllers/admin/opsTeamsController');
const tenantMembersController = require('../controllers/admin/tenantMembersController');
const slaPoliciesController = require('../controllers/admin/slaPoliciesController');
const moderationController = require('../controllers/admin/moderationController');
const categoriesController = require('../controllers/categoriesController');

router.get('/tenants/mine', authenticateToken, tenantController.listMine);
router.post('/tenants/switch', authenticateToken, tenantController.switchTenant);

router.use(authenticateToken, requireTenantMember);

router.get('/malhas/municipio', malhasController.getMunicipio);
router.get('/malhas/bairros', malhasController.getBairros);
router.get('/malhas/setores', malhasController.getSetores);
router.get('/complaints', adminComplaintsController.list);
router.get('/complaints/export', adminComplaintsController.exportCsv);
router.get('/complaints/inbox', adminComplaintsController.inbox);
router.patch(
    '/complaints/:id/status',
    requireTenantRole('operator'),
    adminComplaintsController.patchStatus
);
router.patch(
    '/complaints/:id/assignment',
    requireTenantRole('operator'),
    adminComplaintsController.patchAssignment
);
router.post(
    '/complaints/:id/notes',
    requireTenantRole('operator'),
    adminComplaintsController.postNote
);
router.get('/complaints/:id/events', adminComplaintsController.getEvents);
router.get('/complaints/:id/messages', complaintMessageController.getAdminMessages);
router.post(
    '/complaints/:id/messages',
    requireTenantRole('operator'),
    complaintMessageController.postAdminMessage
);
router.patch('/complaints/:id/messages/read', complaintMessageController.patchAdminRead);
router.get('/complaints/:id', adminComplaintsController.getById);

router.get('/ops-teams', opsTeamsController.list);
router.post('/ops-teams', requireTenantRole('admin'), opsTeamsController.create);
router.patch('/ops-teams/:id', requireTenantRole('admin'), opsTeamsController.update);
router.get('/ops-teams/:id/members', opsTeamsController.listMembers);
router.post(
    '/ops-teams/:id/members',
    requireTenantRole('admin'),
    opsTeamsController.addMember
);
router.delete(
    '/ops-teams/:id/members/:userId',
    requireTenantRole('admin'),
    opsTeamsController.removeMember
);

router.get('/tenant-members', requireTenantRole('admin'), tenantMembersController.list);

router.get('/sla-policies', requireTenantRole('admin'), slaPoliciesController.list);
router.put('/sla-policies', requireTenantRole('admin'), slaPoliciesController.upsertBatch);

router.get('/moderation/reports', requireTenantRole('admin'), moderationController.listReports);
router.get('/moderation/pending-count', requireTenantRole('admin'), moderationController.pendingCount);
router.post(
    '/moderation/reports/:id/resolve',
    requireTenantRole('admin'),
    moderationController.resolveReport
);

router.get('/categories', categoriesController.list);
router.get('/analytics/summary', analyticsController.summary);
router.get('/analytics/operations', analyticsController.operations);
router.get('/analytics/by-category', analyticsController.byCategory);
router.get('/analytics/ranking-areas', analyticsController.rankingAreas);

module.exports = router;
