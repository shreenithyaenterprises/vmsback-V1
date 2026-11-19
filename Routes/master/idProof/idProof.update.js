import { express } from '../../../utils/imports.js';
import { updateIdProof } from '../../../controller/master/idProof/idProof.update.js';

const router = express.Router();

router.put('/update', updateIdProof);

export default router;
