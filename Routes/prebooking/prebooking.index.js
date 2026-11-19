import { express } from '../../utils/imports.js';
import requestRoutes from './request/request.index.js';
import templateRoutes from './template/template.index.js';
import approvalRoutes from './approval.index.js';
import gateRoutes from './gate/gate.index.js';
import securityRoutes from './security/security.index.js';
import reportRoutes from './report/report.index.js';
import dashboardRoutes from './dashboard/dashboard.index.js';
// Note: Public routes are registered separately in Routes.index.js (no auth)

const router = express.Router();

router.use('/request', requestRoutes);
router.use('/template', templateRoutes);
router.use('/approval', approvalRoutes);
router.use('/gate', gateRoutes);
router.use('/security-check', securityRoutes);
router.use('/report', reportRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
