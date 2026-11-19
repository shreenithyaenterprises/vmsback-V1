import { express } from '../../../utils/imports.js';
import { getApprovalRules } from '../../../controller/master/approvalRule/approvalRule.get.js';

const router = express.Router();

router.post('/', getApprovalRules);

export default router;
