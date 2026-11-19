import { express } from '../../utils/imports.js';
import visitorTypeRoutes from './visitorType/visitorType.index.js';
import purposeRoutes from './purpose/purpose.index.js';
import employeeRoutes from './employee/employee.index.js';
import departmentRoutes from './department/department.index.js';
import designationRoutes from './designation/designation.index.js';
import idProofRoutes from './idProof/idProof.index.js';
import badgeRoutes from './badge/badge.index.js';
import approvalRuleRoutes from './approvalRule/approvalRule.index.js';
import approvalAuthorityRoutes from './approvalAuthority/approvalAuthority.index.js';
import timePolicyRoutes from './timePolicy/timePolicy.index.js';
import ppeRoutes from './ppe/ppe.index.js';

const router = express.Router();

router.use('/visitor-type', visitorTypeRoutes);
router.use('/purpose', purposeRoutes);
router.use('/employee', employeeRoutes);
router.use('/department', departmentRoutes);
router.use('/designation', designationRoutes);
router.use('/id-proof', idProofRoutes);
router.use('/badge', badgeRoutes);
router.use('/approval-rule', approvalRuleRoutes);
router.use('/approval-authority', approvalAuthorityRoutes);
router.use('/time-policy', timePolicyRoutes);
router.use('/ppe', ppeRoutes);
import companyConfigRoutes from './companyConfig.index.js';
router.use('/company-config', companyConfigRoutes);

export default router;
