import { express } from '../../utils/imports.js';
import POST from './auth.post.js';

const router = express.Router();

router.use('/', POST);

export default router;
