import { express } from '../../../utils/imports.js';
import { getPurposes } from '../../../controller/master/purpose/purpose.get.js';

const router = express.Router();

router.post('/', getPurposes);

export default router;
