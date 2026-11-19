import { express } from '../../../utils/imports.js';
import { getHomeDashboardSummary } from '../../../controller/prebooking/home.dashboard.get.js';

const router = express.Router();

router.post('/', getHomeDashboardSummary);

export default router;
