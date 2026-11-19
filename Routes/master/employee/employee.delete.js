import { express } from '../../../utils/imports.js';
import { deleteEmployee } from '../../../controller/master/employee/employee.delete.js';

const router = express.Router();

router.delete('/delete', deleteEmployee);
router.post('/delete', deleteEmployee);

export default router;
