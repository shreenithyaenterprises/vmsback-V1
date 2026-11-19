import { express } from '../../../utils/imports.js';
import { createApprovalRule } from '../../../controller/master/approvalRule/approvalRule.post.js';

const router = express.Router();

router.post('/create', createApprovalRule);

export default router;
