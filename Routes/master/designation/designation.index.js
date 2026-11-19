import { express } from '../../../utils/imports.js';
import GET from './designation.get.js';
import POST from './designation.post.js';
import UPDATE from './designation.update.js';
import DELETE from './designation.delete.js';

const router = express.Router();

router.use('/get', GET);
router.use('/', POST);
router.use('/', UPDATE);
router.use('/', DELETE);

export default router;
