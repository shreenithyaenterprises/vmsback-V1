import { express } from '../../../utils/imports.js';
import GET from './idProof.get.js';
import POST from './idProof.post.js';
import UPDATE from './idProof.update.js';
import DELETE from './idProof.delete.js';

const router = express.Router();

router.use('/get', GET);
router.use('/', POST);
router.use('/', UPDATE);
router.use('/', DELETE);

export default router;
