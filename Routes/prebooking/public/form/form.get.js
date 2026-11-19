import { express } from '../../../../utils/imports.js';
import { getPrebookingForm } from '../../../../controller/prebooking/prebooking.form.get.js';

const router = express.Router();

router.post('/', getPrebookingForm);

export default router;
