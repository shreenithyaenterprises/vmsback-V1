import { express } from '../../../utils/imports.js';
import LIST from './report.list.js';

const router = express.Router();

router.use('/list', LIST);

export default router;
