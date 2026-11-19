import { express } from '../../../utils/imports.js';
import { deleteBadge } from '../../../controller/master/badge/badge.delete.js';

const router = express.Router();

router.delete('/delete', deleteBadge);
router.post('/delete', deleteBadge);

export default router;
