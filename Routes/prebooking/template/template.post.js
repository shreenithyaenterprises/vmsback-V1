import { express } from '../../../utils/imports.js';
import { createPrebookingTemplate } from '../../../controller/prebooking/prebooking.template.create.js';

const router = express.Router();

router.post('/create', createPrebookingTemplate);

export default router;
