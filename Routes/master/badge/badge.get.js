import { express } from '../../../utils/imports.js';
import { getBadges } from '../../../controller/master/badge/badge.get.js';

const router = express.Router();

router.post('/', getBadges);

export default router;
