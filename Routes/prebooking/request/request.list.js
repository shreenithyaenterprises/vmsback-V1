import { express } from '../../../utils/imports.js';
import { listPrebookingRequests } from '../../../controller/prebooking/prebooking.request.list.js';

const router = express.Router();

router.post('/', listPrebookingRequests);

export default router;
