import { express } from '../../../utils/imports.js';
import { listPrebookingTemplates } from '../../../controller/prebooking/prebooking.template.list.js';

const router = express.Router();

router.post('/', listPrebookingTemplates);

export default router;
