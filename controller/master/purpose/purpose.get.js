import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildGetXml } from './purpose.utils.js';

export const getPurposes = async (req, res, next) => {
	try {
		logger.info('getPurposes API called');

		const { PurposeId } = req.body || {};
		const xmlData = buildGetXml({ PurposeId });

		const result = await executeProcedureXml('Purpose_Get_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error fetching purposes: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed fetching purposes: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Purposes fetched',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during fetching purposes: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
