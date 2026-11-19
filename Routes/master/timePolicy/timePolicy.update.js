import { express } from '../../../utils/imports.js';
import { updateTimePolicy } from '../../../controller/master/timePolicy/timePolicy.update.js';

const router = express.Router();

router.put('/update', updateTimePolicy);

export default router;
