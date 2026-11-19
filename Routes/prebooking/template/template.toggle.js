import { express } from '../../../utils/imports.js';
import { togglePrebookingTemplate } from '../../../controller/prebooking/prebooking.template.toggle.js';

const router = express.Router();

router.put('/toggle', togglePrebookingTemplate);

export default router;
