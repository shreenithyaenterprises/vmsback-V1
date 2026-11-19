import { express } from '../../../../utils/imports.js';
import { submitPrebookingForm } from '../../../../controller/prebooking/prebooking.form.submit.js';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../../../../uploads/visitor-photos');

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
	destination: (_req, _file, cb) => cb(null, uploadDir),
	filename: (_req, file, cb) => {
		const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
		cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-visitor-photo${ext}`);
	},
});

const upload = multer({
	storage,
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		if (!file.mimetype?.startsWith('image/')) {
			return cb(new Error('Only image files are allowed'));
		}
		return cb(null, true);
	},
});

router.post('/submit', upload.single('VisitorPhoto'), (req, _res, next) => {
	if (req.file) {
		req.body.VisitorPhotoBase64 = `/api/uploads/visitor-photos/${req.file.filename}`;
	}
	next();
}, submitPrebookingForm);

export default router;
