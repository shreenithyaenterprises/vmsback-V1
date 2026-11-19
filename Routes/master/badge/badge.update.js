import { express } from '../../../utils/imports.js';
import { updateBadge } from '../../../controller/master/badge/badge.update.js';

const router = express.Router();

router.put('/update', updateBadge);

export default router;
