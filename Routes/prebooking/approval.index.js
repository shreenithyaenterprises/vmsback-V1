import { express } from '../../utils/imports.js';
import {
	getApprovalAuthority,
	createApprovalRecord,
	submitApprovalDecision,
	getApprovalStatus,
	getPendingApprovals,
} from '../../controller/prebooking/approval.controller.js';
import {
	getCeatInterplantPendingApprovals,
	submitCeatInterplantDecision,
} from '../../controller/prebooking/ceat.interplant.controller.js';

const router = express.Router();

// Get approval authority for a visitor selection
router.post('/authority', getApprovalAuthority);

// Create approval record (when form is submitted)
router.post('/record', createApprovalRecord);

// Get approval status/history for a prebooking
router.get('/status', getApprovalStatus);

// Get pending approvals for the logged-in user
router.get('/pending', getPendingApprovals);

// Submit approval decision (approve or reject)
router.post('/decision', submitApprovalDecision);

// CEAT inter-plant approvals
router.get('/ceat-interplant/pending', getCeatInterplantPendingApprovals);
router.post('/ceat-interplant/decision', submitCeatInterplantDecision);

export default router;
