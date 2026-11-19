/**
 * Security Check Routes
 * Routes for direct visitor entry without pre-booking
 */

import { express } from '../../../utils/imports.js';
import { authenticateToken } from '../../../middlewares/auth.js';
import {
	createDirectVisitorRequest,
	getPendingRequests,
	getSecurityCheckDetails,
	approveSecurityCheck,
	rejectSecurityCheck
} from '../../../controller/prebooking/security/directVisitor.controller.js';
import {
	createGovernmentOfficialEntry,
	listGovernmentOfficialEntriesToday,
	checkInGovernmentOfficial,
	checkOutGovernmentOfficial,
} from '../../../controller/prebooking/security/governmentOfficial.controller.js';

const router = express.Router();

/**
 * Public Routes (No Authentication Required)
 */
// None currently

/**
 * Protected Routes (Authentication Required)
 */

// POST: Create direct visitor request (requires auth - security guard login)
router.post('/create', authenticateToken, createDirectVisitorRequest);

// GET: Get pending security check requests for current approver
router.get('/pending', authenticateToken, getPendingRequests);

// GET: Get specific security check request details
router.get('/:id', authenticateToken, getSecurityCheckDetails);

// POST: Approve security check request
router.post('/:id/approve', authenticateToken, approveSecurityCheck);

// POST: Reject security check request
router.post('/:id/reject', authenticateToken, rejectSecurityCheck);

// Government official direct entry routes (no approval)
router.post('/government/create', authenticateToken, createGovernmentOfficialEntry);
router.post('/government/today', authenticateToken, listGovernmentOfficialEntriesToday);
router.post('/government/check-in', authenticateToken, checkInGovernmentOfficial);
router.post('/government/check-out', authenticateToken, checkOutGovernmentOfficial);

export default router;
