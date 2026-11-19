import { express } from '../../../utils/imports.js';
import { getDepartments } from '../../../controller/master/department/department.get.js';

const router = express.Router();

router.post('/', getDepartments);
router.get('/', getDepartments);

export default router;
