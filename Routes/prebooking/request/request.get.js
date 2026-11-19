import { express } from '../../../utils/imports.js';
import { getPrebookingRequestByToken } from '../../../controller/prebooking/prebooking.request.get.js';

const router = express.Router();

router.post('/', getPrebookingRequestByToken);

export default router;
