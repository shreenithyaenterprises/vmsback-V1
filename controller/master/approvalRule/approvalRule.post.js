import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildCreateXml } from './approvalRule.utils.js';

export const createApprovalRule = async (req, res, next) => {
	try {
		logger.info('createApprovalRule API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.ApprovalRuleVisitorTypeRule,
			RequiredRules.ApprovalRuleStatusRule,
		]);
		if (errorResponse) return;

		const { VisitorTypeCode, ApprovalStatus } = req.body;
		const xmlData = buildCreateXml({ VisitorTypeCode, ApprovalStatus });

		const result = await executeProcedureXml(
			'ApprovalRule_Create_SP',
			'main',
			xmlData
		);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error creating approval rule: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed creating approval rule: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.CREATED).json({
			success: true,
			message: result?.data?.Message || 'Approval rule created',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during creating approval rule: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
