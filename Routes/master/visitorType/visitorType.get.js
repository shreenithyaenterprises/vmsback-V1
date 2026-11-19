import { express } from '../../../utils/imports.js';
import { getVisitorTypes } from '../../../controller/master/visitorType/visitorType.get.js';

const router = express.Router();

router.post('/', getVisitorTypes);

export default router;
