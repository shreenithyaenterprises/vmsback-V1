import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildGetXml } from './timePolicy.utils.js';

export const getTimePolicies = async (req, res, next) => {
	try {
		logger.info('getTimePolicies API called');

		const { PolicyId } = req.body || {};
		const xmlData = buildGetXml({ PolicyId });

		const result = await executeProcedureXml('TimePolicy_Get_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error fetching time policies: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed fetching time policies: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Time policies fetched',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during fetching time policies: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
