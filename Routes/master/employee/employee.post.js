import { express } from '../../../utils/imports.js';
import { createEmployee } from '../../../controller/master/employee/employee.post.js';

const router = express.Router();

router.post('/create', createEmployee);

export default router;
