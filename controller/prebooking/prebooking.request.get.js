import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../utils/imports.js';
import { buildRequestGetByTokenXml } from './prebooking.utils.js';

export const getPrebookingRequestByToken = async (req, res, next) => {
	try {
		logger.info('getPrebookingRequestByToken API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.PrebookingTokenRule,
		]);
		if (errorResponse) return;

		const { Token } = req.body;
		const xmlData = buildRequestGetByTokenXml({ Token });

		const result = await executeProcedureXml(
			'Prebooking_Request_GetByToken_SP',
			'main',
			xmlData
		);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error fetching prebooking request: ${result?.error}`);
				return next(createError(STATUS_CODES.NOT_FOUND, result?.error));
			}
			logger.error(`Stored procedure failed fetching prebooking request: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Prebooking request fetched',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during fetching prebooking request: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
