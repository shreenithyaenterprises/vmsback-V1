import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildUpdateXml } from './approvalRule.utils.js';

export const updateApprovalRule = async (req, res, next) => {
	try {
		logger.info('updateApprovalRule API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.ApprovalRuleIdRule,
			RequiredRules.ApprovalRuleVisitorTypeRule,
			RequiredRules.ApprovalRuleStatusRule,
		]);
		if (errorResponse) return;

		const { RuleId, VisitorTypeCode, ApprovalStatus } = req.body;
		const xmlData = buildUpdateXml({ RuleId, VisitorTypeCode, ApprovalStatus });

		const result = await executeProcedureXml(
			'ApprovalRule_Update_SP',
			'main',
			xmlData
		);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error updating approval rule: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed updating approval rule: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Approval rule updated',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during updating approval rule: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
