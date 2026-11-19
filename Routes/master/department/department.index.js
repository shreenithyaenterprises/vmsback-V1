import { express } from '../../../utils/imports.js';
import GET from './department.get.js';
import POST from './department.post.js';
import UPDATE from './department.update.js';
import DELETE from './department.delete.js';

const router = express.Router();

router.use('/get', GET);
router.use('/', POST);
router.use('/', UPDATE);
router.use('/', DELETE);

export default router;
