import { express } from '../../../../utils/imports.js';
import { getApprovalAuthorityPublic } from '../../../../controller/prebooking/prebooking.approval.public.js';
import { submitPublicApprovalDecision } from '../../../../controller/prebooking/approval.controller.js';

const router = express.Router();

router.post('/authority', getApprovalAuthorityPublic);
router.get('/decision', submitPublicApprovalDecision);
router.post('/decision', submitPublicApprovalDecision);

export default router;
