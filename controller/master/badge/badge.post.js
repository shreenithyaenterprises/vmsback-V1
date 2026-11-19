import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildCreateXml } from './badge.utils.js';

export const createBadge = async (req, res, next) => {
	try {
		logger.info('createBadge API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.BadgeCodeRule,
			RequiredRules.BadgeColorRule,
		]);
		if (errorResponse) return;

		const { Code, Color } = req.body;
		const xmlData = buildCreateXml({ Code, Color });

		const result = await executeProcedureXml('Badge_Create_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error creating badge: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed creating badge: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.CREATED).json({
			success: true,
			message: result?.data?.Message || 'Badge created',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during creating badge: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
