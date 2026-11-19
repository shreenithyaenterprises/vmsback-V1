import { express } from '../../../utils/imports.js';
import GET from './approvalRule.get.js';
import POST from './approvalRule.post.js';
import UPDATE from './approvalRule.update.js';
import DELETE from './approvalRule.delete.js';

const router = express.Router();

router.use('/get', GET);
router.use('/', POST);
router.use('/', UPDATE);
router.use('/', DELETE);

export default router;
