import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const apiRootDir = path.resolve(currentDir, '..');
const parentDir = path.resolve(apiRootDir, '..');

const envCandidates = [
	path.resolve(apiRootDir, '.env'),
	path.resolve(apiRootDir, '.env.dev'),
	path.resolve(process.cwd(), '.env'),
	path.resolve(parentDir, '.env'),
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));

if (envPath) {
	dotenvConfig({ path: envPath });
	console.log(`Loaded environment from: ${envPath}`);
} else {
	console.warn(`[WARNING] No .env file found! Checked locations:`);
	envCandidates.forEach((c) => console.warn(`  - ${c}`));
	console.warn(`Please create a .env file (copy .env.example) with DB_HOST, DB_NAME, DB_USER, DB_PASS.`);
}

const loadConfig = () => ({
	DB_HOST: process.env.DB_HOST || process.env.DB_SERVER,
	DB_USER: process.env.DB_USER,
	DB_PASS: process.env.DB_PASS || process.env.DB_PASSWORD,
	DB_PORT: process.env.DB_PORT,
	DB_NAME: process.env.DB_NAME,
	DB_HOST_CLIENT: process.env.DB_HOST_CLIENT || process.env.DB_SERVER_CLIENT,
	DB_USER_CLIENT: process.env.DB_USER_CLIENT,
	DB_PASS_CLIENT: process.env.DB_PASS_CLIENT || process.env.DB_PASSWORD_CLIENT,
	DB_PORT_CLIENT: process.env.DB_PORT_CLIENT,
	DB_NAME_CLIENT: process.env.DB_NAME_CLIENT,
	SMTP_HOST: process.env.SMTP_HOST,
	SMTP_PORT: process.env.SMTP_PORT,
	SMTP_SECURE: process.env.SMTP_SECURE,
	SMTP_USER: process.env.SMTP_USER,
	SMTP_PASS: process.env.SMTP_PASS,
	SMTP_FROM: process.env.SMTP_FROM,
	SMTP_FROM_NAME: process.env.SMTP_FROM_NAME,
});

export default loadConfig;
