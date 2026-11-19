import { express } from '../../../utils/imports.js';
import { updatePurpose } from '../../../controller/master/purpose/purpose.update.js';

const router = express.Router();

router.put('/update', updatePurpose);

export default router;
