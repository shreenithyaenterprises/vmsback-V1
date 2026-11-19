import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildUpdateXml } from './badge.utils.js';

export const updateBadge = async (req, res, next) => {
	try {
		logger.info('updateBadge API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.BadgeIdRule,
			RequiredRules.BadgeCodeRule,
			RequiredRules.BadgeColorRule,
		]);
		if (errorResponse) return;

		const { BadgeId, Code, Color } = req.body;
		const xmlData = buildUpdateXml({ BadgeId, Code, Color });

		const result = await executeProcedureXml('Badge_Update_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error updating badge: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed updating badge: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Badge updated',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during updating badge: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
