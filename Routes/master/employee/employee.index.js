import { express } from '../../../utils/imports.js';
import GET from './employee.get.js';
import POST from './employee.post.js';
import UPDATE from './employee.update.js';
import DELETE from './employee.delete.js';

const router = express.Router();

router.use('/get', GET);
router.use('/', POST);
router.use('/', UPDATE);
router.use('/', DELETE);

export default router;
