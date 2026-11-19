import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildCreateXml } from './purpose.utils.js';

export const createPurpose = async (req, res, next) => {
	try {
		logger.info('createPurpose API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.PurposeCodeRule,
			RequiredRules.PurposeNameRule,
		]);
		if (errorResponse) return;

		const { Code, Name } = req.body;
		const xmlData = buildCreateXml({ Code, Name });

		const result = await executeProcedureXml('Purpose_Create_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error creating purpose: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed creating purpose: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.CREATED).json({
			success: true,
			message: result?.data?.Message || 'Purpose created',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during creating purpose: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
