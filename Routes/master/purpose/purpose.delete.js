import { express } from '../../../utils/imports.js';
import { deletePurpose } from '../../../controller/master/purpose/purpose.delete.js';

const router = express.Router();

router.delete('/delete', deletePurpose);
router.post('/delete', deletePurpose);

export default router;
