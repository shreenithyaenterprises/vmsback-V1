import { express } from '../../../../utils/imports.js';
import {
	getVisitByReferenceCode,
	checkInVisitor,
	checkOutVisitor,
	toggleVisitByReferenceCode,
	getPendingCheckIns,
} from '../../../../controller/prebooking/visit.gate.controller.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/lookup-code', getVisitByReferenceCode);
router.post('/check-in', checkInVisitor);
router.post('/check-out', checkOutVisitor);
router.post('/toggle-scan', toggleVisitByReferenceCode);
router.get('/pending', getPendingCheckIns);

export default router;
