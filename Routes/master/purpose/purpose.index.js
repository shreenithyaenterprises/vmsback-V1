import { express } from '../../../utils/imports.js';
import GET from './purpose.get.js';
import POST from './purpose.post.js';
import UPDATE from './purpose.update.js';
import DELETE from './purpose.delete.js';

const router = express.Router();

router.use('/get', GET);
router.use('/', POST);
router.use('/', UPDATE);
router.use('/', DELETE);

export default router;
