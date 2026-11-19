import { express } from '../../../utils/imports.js';
import { updateVisitorType } from '../../../controller/master/visitorType/visitorType.update.js';

const router = express.Router();

router.put('/update', updateVisitorType);

export default router;
