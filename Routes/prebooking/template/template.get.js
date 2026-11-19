import { express } from '../../../utils/imports.js';
import { getPrebookingTemplate } from '../../../controller/prebooking/prebooking.template.get.js';

const router = express.Router();

router.post('/', getPrebookingTemplate);

export default router;
