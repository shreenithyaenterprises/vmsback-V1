import sql from 'mssql';
import loadConfig from './config.js';

const {
	DB_HOST,
	DB_USER,
	DB_PASS,
	DB_PORT,
	DB_NAME,
	DB_HOST_CLIENT,
	DB_USER_CLIENT,
	DB_NAME_CLIENT,
	DB_PASS_CLIENT,
	DB_PORT_CLIENT,
} = loadConfig();

const DEFAULT_SQL_PORT = 1433;
const toSqlPort = (value) => {
	const port = Number(value);
	return Number.isInteger(port) && port > 0 ? port : DEFAULT_SQL_PORT;
};

const dbConfig = {
	user: DB_USER,
	password: DB_PASS,
	server: DB_HOST,
	port: toSqlPort(DB_PORT),
	database: DB_NAME,
	pool: {
		max: 50,
		min: 0,
		idleTimeoutMillis: 30000,
	},
	options: {
		encrypt: false,
		trustServerCertificate: true,
	},
};

const dbConfigClient = {
	user: DB_USER_CLIENT,
	password: DB_PASS_CLIENT,
	server: DB_HOST_CLIENT,
	port: toSqlPort(DB_PORT_CLIENT),
	database: DB_NAME_CLIENT,
	pool: {
		max: 50,
		min: 0,
		idleTimeoutMillis: 30000,
	},
	options: {
		encrypt: false,
		trustServerCertificate: true,
	},
};

let mainDb;
let clientDb;
let clientDbFailed = false;

const getDatabaseByTarget = async (dbTarget = 'main') => {
	if (dbTarget === 'main') {
		if (!mainDb) {
			if (!dbConfig.server || !dbConfig.database) {
				throw new Error(
					`Database configuration missing! DB_HOST/DB_SERVER is '${dbConfig.server}', DB_NAME is '${dbConfig.database}'. Please set these in your .env file.`
				);
			}
			console.log(`Connecting to MAIN database ${dbConfig.server}:${dbConfig.port}/${dbConfig.database}`);
			mainDb = await sql.connect(dbConfig);
			console.log('Connected to MAIN database');
		}
		return mainDb;
	}

	if (dbTarget === 'client') {
		if (clientDbFailed) {
			console.warn('Skipping CLIENT DB attempt - previous failure');
			return null;
		}

		if (!clientDb) {
			try {
				console.log(
					`Connecting to CLIENT database ${dbConfigClient.server}:${dbConfigClient.port}/${dbConfigClient.database}`
				);
				clientDb = await new sql.ConnectionPool(dbConfigClient).connect();
				console.log('Connected to CLIENT database');
			} catch (err) {
				console.warn('CLIENT DB connection failed:', err.message);
				clientDbFailed = true;
				return null;
			}
		}
		return clientDb;
	}

	throw new Error('Unknown DB target');
};

export { getDatabaseByTarget };
