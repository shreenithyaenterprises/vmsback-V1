import { express } from '../../../utils/imports.js';
import { deleteApprovalRule } from '../../../controller/master/approvalRule/approvalRule.delete.js';

const router = express.Router();

router.delete('/delete', deleteApprovalRule);
router.post('/delete', deleteApprovalRule);

export default router;
