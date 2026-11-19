import { express } from '../../../utils/imports.js';
import { updatePrebookingTemplate } from '../../../controller/prebooking/prebooking.template.update.js';

const router = express.Router();

router.put('/update', updatePrebookingTemplate);

export default router;
