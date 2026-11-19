import { express } from '../../../../utils/imports.js';
import { getPublicFormLookups } from '../../../../controller/prebooking/prebooking.form.lookups.js';

const router = express.Router();

router.get('/', getPublicFormLookups);

export default router;