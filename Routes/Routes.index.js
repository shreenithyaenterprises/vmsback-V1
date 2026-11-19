import { express } from '../utils/imports.js';
import authenticateToken from '../middlewares/auth.js';
import authRoutes from './auth/auth.index.js';
import masterRoutes from './master/master.index.js';
import prebookingRoutes from './prebooking/prebooking.index.js';
import prebookingPublicRoutes from './prebooking/public/public.index.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/prebooking/public', prebookingPublicRoutes); // ← NO AUTH - Public access
router.use('/master', authenticateToken, masterRoutes);
router.use('/prebooking', authenticateToken, prebookingRoutes);

export default router;
