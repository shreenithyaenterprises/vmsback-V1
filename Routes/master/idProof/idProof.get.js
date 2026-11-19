import { express } from '../../../utils/imports.js';
import { getIdProofs } from '../../../controller/master/idProof/idProof.get.js';

const router = express.Router();

router.post('/', getIdProofs);

export default router;
