import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildDeleteXml } from './approvalRule.utils.js';

export const deleteApprovalRule = async (req, res, next) => {
	try {
		logger.info('deleteApprovalRule API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.ApprovalRuleIdRule,
		]);
		if (errorResponse) return;

		const { RuleId } = req.body || {};
		const resolvedId = RuleId ?? req.query?.RuleId;
		if (!resolvedId) {
			logger.error('RuleId is required for delete');
			return next(createError(STATUS_CODES.BAD_REQUEST, 'RuleId is required'));
		}
		const xmlData = buildDeleteXml({ RuleId: resolvedId });

		const result = await executeProcedureXml(
			'ApprovalRule_Delete_SP',
			'main',
			xmlData
		);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error deleting approval rule: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed deleting approval rule: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Approval rule deleted',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during deleting approval rule: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
