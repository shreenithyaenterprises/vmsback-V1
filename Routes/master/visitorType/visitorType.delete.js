import { express } from '../../../utils/imports.js';
import { deleteVisitorType } from '../../../controller/master/visitorType/visitorType.delete.js';

const router = express.Router();

router.delete('/delete', deleteVisitorType);
router.post('/delete', deleteVisitorType);

export default router;
