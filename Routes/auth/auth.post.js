import { express } from '../../utils/imports.js';
import { login } from '../../controller/auth/login.post.js';
import { changePassword } from '../../controller/auth/changePassword.post.js';

const router = express.Router();

router.post('/login', login);
router.post('/change-password', changePassword);

export default router;
