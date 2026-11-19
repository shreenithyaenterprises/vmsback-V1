import { express } from '../../../utils/imports.js';
import { createVisitorType } from '../../../controller/master/visitorType/visitorType.post.js';

const router = express.Router();

router.post('/create', createVisitorType);

export default router;
