import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../utils/imports.js';
import { buildChangePasswordXml } from './auth.utils.js';

export const changePassword = async (req, res, next) => {
	try {
		logger.info('changePassword API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.UserIdRule,
			RequiredRules.OldPasswordRule,
			RequiredRules.NewPasswordRule,
		]);
		if (errorResponse) return;

		const { UserId, OldPassword, NewPassword } = req.body;
		const xmlData = buildChangePasswordXml({ UserId, OldPassword, NewPassword });

		const result = await executeProcedureXml(
			'UserProfile_ChangePassword_SP',
			'main',
			xmlData
		);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Change password failed: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed changing password: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Password changed',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during changing password: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
