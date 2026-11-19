import { express } from '../../../utils/imports.js';
import { updateDepartment } from '../../../controller/master/department/department.update.js';

const router = express.Router();

router.put('/update', updateDepartment);

export default router;
