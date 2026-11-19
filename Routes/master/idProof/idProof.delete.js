import { express } from '../../../utils/imports.js';
import { deleteIdProof } from '../../../controller/master/idProof/idProof.delete.js';

const router = express.Router();

router.delete('/delete', deleteIdProof);
router.post('/delete', deleteIdProof);

export default router;
