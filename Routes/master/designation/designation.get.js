import { express } from '../../../utils/imports.js';
import { getDesignations } from '../../../controller/master/designation/designation.get.js';

const router = express.Router();

router.post('/', getDesignations);
router.get('/', getDesignations);

export default router;
