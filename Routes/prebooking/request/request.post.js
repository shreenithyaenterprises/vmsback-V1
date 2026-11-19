import { express } from '../../../utils/imports.js';
import { createPrebookingRequest } from '../../../controller/prebooking/prebooking.request.post.js';
// import { createPrebookingWhatsAppRequest } from '../../../controller/prebooking/prebooking.request.whatsapp.post.js';

const router = express.Router();

router.post('/create', createPrebookingRequest);
// router.post('/create-whatsapp', createPrebookingWhatsAppRequest);

export default router;
