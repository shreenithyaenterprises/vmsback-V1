import { express } from '../../../utils/imports.js';
import { deleteTimePolicy } from '../../../controller/master/timePolicy/timePolicy.delete.js';

const router = express.Router();

router.delete('/delete', deleteTimePolicy);
router.post('/delete', deleteTimePolicy);

export default router;
