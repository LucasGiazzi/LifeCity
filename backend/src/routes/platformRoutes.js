const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePlatformStaff } = require('../middleware/requirePlatformStaff');
const { requirePlatformRole } = require('../middleware/requirePlatformRole');

const tenantsController = require('../controllers/platform/tenantsController');
const municipalitiesController = require('../controllers/platform/municipalitiesController');
const billingController = require('../controllers/platform/billingController');
const membersController = require('../controllers/platform/membersController');
const impersonationController = require('../controllers/platform/impersonationController');
const auditController = require('../controllers/platform/auditController');
const staffController = require('../controllers/platform/staffController');
const citizensController = require('../controllers/platform/citizensController');

const router = express.Router();

const staffStack = [
    authenticateToken,
    requirePlatformStaff,
];

function withRole(minRole, ...handlers) {
    return [...staffStack, requirePlatformRole(minRole), ...handlers];
}

// Tenants (6b)
router.get('/tenants', ...withRole('viewer', tenantsController.list));
router.post('/tenants', ...withRole('operator', tenantsController.create));
router.get('/tenants/:id', ...withRole('viewer', tenantsController.get));
router.patch('/tenants/:id', ...withRole('operator', tenantsController.patch));
router.get('/tenants/:id/health', ...withRole('viewer', tenantsController.health));

// Municipalities + billing (6b)
router.get('/municipalities/search', ...withRole('operator', municipalitiesController.search));
router.get('/billing/estimate', ...withRole('operator', billingController.estimate));

// Members (6c)
router.get('/tenants/:id/members', ...withRole('viewer', membersController.list));
router.post('/tenants/:id/members/invite', ...withRole('operator', membersController.invite));
router.patch('/tenants/:id/members/:userId', ...withRole('operator', membersController.patch));
router.get('/tenants/:id/citizens', ...withRole('viewer', citizensController.list));

// Impersonation (6c)
router.post('/tenants/:id/enter', ...withRole('operator', impersonationController.enter));
router.post(
    '/exit-impersonation',
    authenticateToken,
    requirePlatformStaff,
    impersonationController.exit
);

// Audit (6c)
router.get('/audit-log', ...withRole('viewer', auditController.list));

// Platform staff (6c — admin only)
router.get('/staff', ...withRole('admin', staffController.list));
router.post('/staff', ...withRole('admin', staffController.create));
router.patch('/staff/:userId', ...withRole('admin', staffController.patch));

module.exports = router;
