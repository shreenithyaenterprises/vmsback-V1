import { express } from '../../../utils/imports.js';
import { deleteDepartment } from '../../../controller/master/department/department.delete.js';

const router = express.Router();

router.delete('/delete', deleteDepartment);
router.post('/delete', deleteDepartment);

export default router;
