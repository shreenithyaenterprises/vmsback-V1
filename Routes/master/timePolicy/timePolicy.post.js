import { express } from '../../../utils/imports.js';
import { createTimePolicy } from '../../../controller/master/timePolicy/timePolicy.post.js';

const router = express.Router();

router.post('/create', createTimePolicy);

export default router;
