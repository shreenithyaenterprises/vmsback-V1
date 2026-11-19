import { express } from '../../../utils/imports.js';
import { createPurpose } from '../../../controller/master/purpose/purpose.post.js';

const router = express.Router();

router.post('/create', createPurpose);

export default router;
