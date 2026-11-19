import { sql, logger, getDatabaseByTarget } from './imports.js';
import he from 'he';

const decodeStringsInObject = (obj) => {
	if (Array.isArray(obj)) {
		return obj.map(decodeStringsInObject);
	}
	if (obj && typeof obj === 'object') {
		return Object.fromEntries(
			Object.entries(obj).map(([key, value]) => [key, decodeStringsInObject(value)])
		);
	}
	if (typeof obj === 'string') {
		return he.decode(obj);
	}
	return obj;
};

const executeProcedureXml = async (procedureName, dbTarget = 'main', xmlData = '') => {
	try {
		logger.info(`Executing stored procedure: ${procedureName}`);

		const xmlInput = typeof xmlData === 'string' ? xmlData : '';
		logger.info(`@XMLData = '${xmlInput}'`);

		const pool = await getDatabaseByTarget(dbTarget);
		if (!pool) {
			logger.error(`[${procedureName}] ${dbTarget.toUpperCase()} DB not connected.`);
			return { success: false, message: 'DB connection failed' };
		}

		const request = pool.request();
		request.input('XMLData', sql.NVarChar(sql.MAX), xmlInput);

		const result = await request.execute(procedureName);
		const jsonString = result?.recordset?.[0]?.ReturnValue;
		if (!jsonString) {
			const msg = `Procedure ${procedureName} returned no JSON result`;
			logger.warn(msg);
			return { success: false, errorType: 'PE', error: msg };
		}

		let data;
		try {
			data = JSON.parse(jsonString);
			data = decodeStringsInObject(data);
		} catch (err) {
			const msg = `Failed to parse JSON from procedure: ${err.message}`;
			logger.error(msg);
			return { success: false, errorType: 'PE', error: msg };
		}

		if (data?.Success === 'S') {
			return { success: true, errorType: null, error: null, data };
		}
		if (data?.Success === 'E') {
			return { success: false, errorType: 'E', error: data?.Message || 'Something Went Wrong' };
		}

		return {
			success: false,
			errorType: 'PE',
			error: data?.Message || 'Processing error or undefined status from procedure',
		};
	} catch (error) {
		const msg = `Error executing procedure ${procedureName}: ${error.message}`;
		logger.error(msg);
		return { success: false, errorType: 'PE', error: msg };
	}
};

export default executeProcedureXml;
