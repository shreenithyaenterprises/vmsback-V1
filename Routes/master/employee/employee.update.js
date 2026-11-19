import { express } from '../../../utils/imports.js';
import { updateEmployee } from '../../../controller/master/employee/employee.update.js';

const router = express.Router();

router.put('/update', updateEmployee);

export default router;
