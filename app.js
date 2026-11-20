import { express, cors, STATUS_CODES, STATUS_MESSAGES } from './utils/imports.js';
import routes from './Routes/Routes.index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAllowedOrigins = () => {
	const raw = process.env.ALLOWED_ORIGINS;
	if (!raw) return [];
	return raw
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);
};

const isPrivateOrLocalHost = (hostname) => {
	if (!hostname) return false;
	if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
	if (/^127\.\d+\.\d+\.\d+$/.test(hostname)) return true;
	if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) return true;
	if (/^192\.168\.\d+\.\d+$/.test(hostname)) return true;
	if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(hostname)) return true;
	return false;
};

const isOriginAllowed = (origin) => {
	if (!origin) return true;

	const allowedOrigins = getAllowedOrigins();

	// If ALLOWED_ORIGINS is '*' or empty/not configured, allow all origins
	if (allowedOrigins.length === 0 || allowedOrigins.includes('*')) {
		return true;
	}

	try {
		const { hostname } = new URL(origin);

		// Always allow local and private network IPs on any port
		if (isPrivateOrLocalHost(hostname)) {
			return true;
		}

		// Check explicit origin or domain patterns configured in .env
		for (const allowed of allowedOrigins) {
			if (allowed === origin) return true;
			const cleanAllowed = allowed.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
			if (cleanAllowed.startsWith('*.')) {
				const base = cleanAllowed.slice(2);
				if (hostname === base || hostname.endsWith('.' + base)) {
					return true;
				}
			} else if (cleanAllowed === hostname) {
				return true;
			}
		}
	} catch {
		// ignore malformed URLs
	}

	return false;
};

app.use(
	cors({
		origin: (origin, callback) => {
			if (isOriginAllowed(origin)) {
				return callback(null, true);
			}
			return callback(null, false);
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
