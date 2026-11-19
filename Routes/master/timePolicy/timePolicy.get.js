import { express } from '../../../utils/imports.js';
import { getTimePolicies } from '../../../controller/master/timePolicy/timePolicy.get.js';

const router = express.Router();

router.post('/', getTimePolicies);

export default router;
