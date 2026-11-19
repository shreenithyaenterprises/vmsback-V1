import { express } from '../../../utils/imports.js';
import {
	createVisitTransaction,
	getVisitByReferenceCode,
	checkInVisitor,
	checkOutVisitor,
	toggleVisitByReferenceCode,
	getPendingCheckIns,
} from '../../../controller/prebooking/visit.gate.controller.js';

const router = express.Router();

// Protected routes (require authentication)
router.post('/create', createVisitTransaction);
router.post('/lookup-code', getVisitByReferenceCode);
router.post('/check-in', checkInVisitor);
router.post('/check-out', checkOutVisitor);
router.post('/toggle-scan', toggleVisitByReferenceCode);
router.get('/pending', getPendingCheckIns);

export default router;
