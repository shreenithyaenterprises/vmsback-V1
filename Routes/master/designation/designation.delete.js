import { express } from '../../../utils/imports.js';
import { deleteDesignation } from '../../../controller/master/designation/designation.delete.js';

const router = express.Router();

router.delete('/delete', deleteDesignation);
router.post('/delete', deleteDesignation);

export default router;
