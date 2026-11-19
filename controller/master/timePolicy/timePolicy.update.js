import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildUpdateXml } from './timePolicy.utils.js';

export const updateTimePolicy = async (req, res, next) => {
	try {
		logger.info('updateTimePolicy API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.TimePolicyIdRule,
			RequiredRules.TimePolicyVisitorTypeRule,
			RequiredRules.TimePolicyLabelRule,
		]);
		if (errorResponse) return;

		const { PolicyId, VisitorTypeCode, PolicyLabel } = req.body;
		const xmlData = buildUpdateXml({ PolicyId, VisitorTypeCode, PolicyLabel });

		const result = await executeProcedureXml(
			'TimePolicy_Update_SP',
			'main',
			xmlData
		);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error updating time policy: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed updating time policy: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Time policy updated',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during updating time policy: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
