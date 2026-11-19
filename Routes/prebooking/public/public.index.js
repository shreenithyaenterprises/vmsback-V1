import { express } from '../../../utils/imports.js';
import formRoutes from './form/form.index.js';
import approvalRoutes from './approval/approval.index.js';
import gateRoutes from './gate/gate.index.js';
import ceatEmployeeRoutes from './ceatEmployee/ceatEmployee.index.js';

const router = express.Router();

router.use('/form', formRoutes);
router.use('/approval', approvalRoutes);
router.use('/gate', gateRoutes);
router.use('/ceat-employee', ceatEmployeeRoutes);

export default router;
