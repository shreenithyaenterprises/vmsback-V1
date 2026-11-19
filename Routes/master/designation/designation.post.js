import { express } from '../../../utils/imports.js';
import { createDesignation } from '../../../controller/master/designation/designation.post.js';

const router = express.Router();

router.post('/create', createDesignation);

export default router;
