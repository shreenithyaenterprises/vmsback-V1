import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildDeleteXml } from './badge.utils.js';

export const deleteBadge = async (req, res, next) => {
	try {
		logger.info('deleteBadge API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.BadgeIdRule,
		]);
		if (errorResponse) return;

		const { BadgeId } = req.body || {};
		const resolvedId = BadgeId ?? req.query?.BadgeId;
		if (!resolvedId) {
			logger.error('BadgeId is required for delete');
			return next(createError(STATUS_CODES.BAD_REQUEST, 'BadgeId is required'));
		}
		const xmlData = buildDeleteXml({ BadgeId: resolvedId });

		const result = await executeProcedureXml('Badge_Delete_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error deleting badge: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed deleting badge: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Badge deleted',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during deleting badge: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
