import { express } from '../../../utils/imports.js';
import { updateApprovalRule } from '../../../controller/master/approvalRule/approvalRule.update.js';

const router = express.Router();

router.put('/update', updateApprovalRule);

export default router;
