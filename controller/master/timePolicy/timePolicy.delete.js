import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildDeleteXml } from './timePolicy.utils.js';

export const deleteTimePolicy = async (req, res, next) => {
	try {
		logger.info('deleteTimePolicy API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.TimePolicyIdRule,
		]);
		if (errorResponse) return;

		const { PolicyId } = req.body || {};
		const resolvedId = PolicyId ?? req.query?.PolicyId;
		if (!resolvedId) {
			logger.error('PolicyId is required for delete');
			return next(createError(STATUS_CODES.BAD_REQUEST, 'PolicyId is required'));
		}
		const xmlData = buildDeleteXml({ PolicyId: resolvedId });

		const result = await executeProcedureXml(
			'TimePolicy_Delete_SP',
			'main',
			xmlData
		);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error deleting time policy: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed deleting time policy: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Time policy deleted',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during deleting time policy: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
