import { express } from '../../../utils/imports.js';
import { updateDesignation } from '../../../controller/master/designation/designation.update.js';

const router = express.Router();

router.put('/update', updateDesignation);

export default router;
