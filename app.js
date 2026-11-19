import { express, cors, STATUS_CODES, STATUS_MESSAGES } from './utils/imports.js';
import routes from './Routes/Routes.index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) || [];

const isOriginAllowed = (origin) => {
	if (!origin) return true;
	if (allowedOrigins.includes(origin)) return true;
	try {
		const { hostname } = new URL(origin);
		if (hostname === 'snithya.com' || hostname.endsWith('.snithya.com')) {
			return true;
		}
	} catch {
		// ignore invalid origin
	}
	return false;
};

app.use(
	cors({
		origin: (origin, callback) => {
			if (isOriginAllowed(origin)) {
				return callback(null, true);
			}
			return callback(new Error('Not allowed by CORS'));
		},
		credentials: true,
	})
);

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '8mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', routes);
app.use(routes);

app.get('/', (_req, res) => {
	res.send('Welcome to Premium VMS API');
});

app.use((err, _req, res, _next) => {
	const status = err.status || STATUS_CODES.SERVER_ERROR;
	const message = err.message || STATUS_MESSAGES.SERVER_ERROR;

	res.status(status).json({
		success: false,
		status,
		message,
	});
});

export default app;
