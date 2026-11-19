import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const apiRootDir = path.resolve(currentDir, '..');
const envCandidates = [
	path.resolve(apiRootDir, '.env'),
	path.resolve(apiRootDir, '.env.dev'),
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate)) || envCandidates[1];

dotenvConfig({ path: envPath });

const loadConfig = () => ({
	DB_HOST: process.env.DB_HOST,
	DB_USER: process.env.DB_USER,
	DB_PASS: process.env.DB_PASS,
	DB_PORT: process.env.DB_PORT,
	DB_NAME: process.env.DB_NAME,
	DB_HOST_CLIENT: process.env.DB_HOST_CLIENT,
	DB_USER_CLIENT: process.env.DB_USER_CLIENT,
	DB_PASS_CLIENT: process.env.DB_PASS_CLIENT,
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
