import { express } from '../../../utils/imports.js';
import { createIdProof } from '../../../controller/master/idProof/idProof.post.js';

const router = express.Router();

router.post('/create', createIdProof);

export default router;
