import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildGetXml } from './approvalRule.utils.js';

export const getApprovalRules = async (req, res, next) => {
	try {
		logger.info('getApprovalRules API called');

		const { RuleId } = req.body || {};
		const xmlData = buildGetXml({ RuleId });

		const result = await executeProcedureXml('ApprovalRule_Get_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error fetching approval rules: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed fetching approval rules: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Approval rules fetched',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during fetching approval rules: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
