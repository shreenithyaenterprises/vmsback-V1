import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildGetXml } from './visitorType.utils.js';

export const getVisitorTypes = async (req, res, next) => {
	try {
		logger.info('getVisitorTypes API called');

		const { VisitorTypeId } = req.body || {};
		const xmlData = buildGetXml({ VisitorTypeId });

		const result = await executeProcedureXml('VisitorType_Get_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error fetching visitor types: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed fetching visitor types: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Visitor types fetched',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during fetching visitor types: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
