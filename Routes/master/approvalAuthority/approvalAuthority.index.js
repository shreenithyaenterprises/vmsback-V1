import { express } from '../../../utils/imports.js';
import {
	createApprovalAuthority,
	getApprovalAuthorities,
	deleteApprovalAuthority,
} from '../../../controller/master/approvalAuthority/approvalAuthority.controller.js';

const router = express.Router();

// Create approval authority
router.post('/', createApprovalAuthority);

// Get approval authorities
router.get('/', getApprovalAuthorities);

// Delete approval authority
router.delete('/', deleteApprovalAuthority);

export default router;
