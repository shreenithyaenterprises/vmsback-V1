import { express } from '../../../utils/imports.js';
import GET from './visitorType.get.js';
import POST from './visitorType.post.js';
import UPDATE from './visitorType.update.js';
import DELETE from './visitorType.delete.js';

const router = express.Router();

router.use('/get', GET);
router.use('/', POST);
router.use('/', UPDATE);
router.use('/', DELETE);

export default router;
