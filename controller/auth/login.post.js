import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	jwt,
	logger,
	validateRequest,
	RequiredRules,
	VALIDATIONS,
	executeProcedureXml,
} from '../../utils/imports.js';
import { buildLoginXml } from './auth.utils.js';

export const login = async (req, res, next) => {
	try {
		logger.info('login API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.UserIdRule,
			RequiredRules.PasswordRule,
		]);
		if (errorResponse) return;

		const { UserId, Password } = req.body;
		const xmlData = buildLoginXml({ UserId, Password });

		const result = await executeProcedureXml('UserProfile_Login_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Login failed: ${result?.error}`);
				return next(createError(STATUS_CODES.UNAUTHORIZED, result?.error));
			}
			logger.error(`Stored procedure failed during login: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		const tokenSecret = process.env.TOKEN_SECRET_KEY;
		if (!tokenSecret) {
			logger.error('TOKEN_SECRET_KEY is not configured');
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		const tokenPayload = {
			userId: UserId,
			role: result?.data?.Role || null,
		};
		const token = jwt.sign(tokenPayload, tokenSecret, {
			expiresIn: VALIDATIONS.TOKEN_EXPIRY_TIME,
		});

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Login successful',
			token,
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during login: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
