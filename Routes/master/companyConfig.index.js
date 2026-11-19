import { express } from '../../utils/imports.js';
import {
  createCompanyConfig,
  getCompanyConfigs,
  getCompanyConfigById,
  updateCompanyConfig,
  deleteCompanyConfig
} from '../../controller/companyConfig.controller.js';

const router = express.Router();

router.post('/', createCompanyConfig);
router.get('/', getCompanyConfigs);
router.get('/:id', getCompanyConfigById);
router.put('/:id', updateCompanyConfig);
router.delete('/:id', deleteCompanyConfig);

export default router;
