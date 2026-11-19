import { express } from '../../../utils/imports.js';
import { createBadge } from '../../../controller/master/badge/badge.post.js';

const router = express.Router();

router.post('/create', createBadge);

export default router;
