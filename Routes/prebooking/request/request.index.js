import { express } from '../../../utils/imports.js';
import GET from './request.get.js';
import LIST from './request.list.js';
import POST from './request.post.js';

const router = express.Router();

router.use('/get', GET);
router.use('/list', LIST);
router.use('/', POST);

export default router;
