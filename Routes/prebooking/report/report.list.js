import { express } from '../../../utils/imports.js';
import { listVisitorReport } from '../../../controller/prebooking/visitor.report.list.js';

const router = express.Router();

router.post('/', listVisitorReport);

export default router;
