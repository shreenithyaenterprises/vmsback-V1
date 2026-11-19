import { express } from '../../../utils/imports.js';
import GET from './template.get.js';
import LIST from './template.list.js';
import POST from './template.post.js';
import UPDATE from './template.update.js';
import TOGGLE from './template.toggle.js';

const router = express.Router();

router.use('/get', GET);
router.use('/list', LIST);
router.use('/', POST);
router.use('/', UPDATE);
router.use('/', TOGGLE);

export default router;
