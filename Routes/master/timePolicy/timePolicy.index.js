import { express } from '../../../utils/imports.js';
import GET from './timePolicy.get.js';
import POST from './timePolicy.post.js';
import UPDATE from './timePolicy.update.js';
import DELETE from './timePolicy.delete.js';

const router = express.Router();

router.use('/get', GET);
router.use('/', POST);
router.use('/', UPDATE);
router.use('/', DELETE);

export default router;
