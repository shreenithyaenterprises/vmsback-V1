import { express } from '../../../utils/imports.js';
import { getPPEList } from '../../../controller/master/ppe/ppe.list.js';

const router = express.Router();

// Routes
router.get('/list', getPPEList);

export default router;
