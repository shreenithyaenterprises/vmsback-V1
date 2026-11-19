import { express } from '../../../utils/imports.js';
import { getCeatInterplantDashboardList } from '../../../controller/prebooking/ceat.interplant.controller.js';

const router = express.Router();

router.post('/', getCeatInterplantDashboardList);

export default router;
