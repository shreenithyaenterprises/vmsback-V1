import { express } from '../../../utils/imports.js';
import { getEmployees } from '../../../controller/master/employee/employee.get.js';

const router = express.Router();

router.post('/', getEmployees);
router.get('/', getEmployees);

export default router;
