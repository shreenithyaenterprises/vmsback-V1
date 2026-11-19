import { express } from '../../../utils/imports.js';
import { createDepartment } from '../../../controller/master/department/department.post.js';

const router = express.Router();

router.post('/create', createDepartment);

export default router;
