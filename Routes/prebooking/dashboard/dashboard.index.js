import { express } from '../../../utils/imports.js';
import HOME from './dashboard.home.js';
import CEAT from './dashboard.ceat.js';

const router = express.Router();

router.use('/home', HOME);
router.use('/ceat-interplant', CEAT);

export default router;
