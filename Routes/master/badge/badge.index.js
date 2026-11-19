import { express } from '../../../utils/imports.js';
import GET from './badge.get.js';
import POST from './badge.post.js';
import UPDATE from './badge.update.js';
import DELETE from './badge.delete.js';

const router = express.Router();

router.use('/get', GET);
router.use('/', POST);
router.use('/', UPDATE);
router.use('/', DELETE);

export default router;
