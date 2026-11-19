import { express } from '../../../../utils/imports.js';
import GET from './form.get.js';
import SUBMIT from './form.submit.js';
import LOOKUPS from './form.lookups.js';

const router = express.Router();

router.use('/get', GET);
router.use('/lookups', LOOKUPS);
router.use('/', SUBMIT);

export default router;
