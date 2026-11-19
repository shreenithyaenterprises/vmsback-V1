import { express } from '../../../../utils/imports.js';
import {
  createCeatInterplantRequest,
  getCeatInterplantLookups,
  getCeatInterplantStatusByToken,
} from '../../../../controller/prebooking/ceat.interplant.controller.js';

const router = express.Router();

router.post('/create', createCeatInterplantRequest);
router.get('/lookups', getCeatInterplantLookups);
router.post('/status', getCeatInterplantStatusByToken);

export default router;
