import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildUpdateXml } from './purpose.utils.js';

export const updatePurpose = async (req, res, next) => {
	try {
		logger.info('updatePurpose API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.PurposeIdRule,
			RequiredRules.PurposeCodeRule,
			RequiredRules.PurposeNameRule,
		]);
		if (errorResponse) return;

		const { PurposeId, Code, Name } = req.body;
		const xmlData = buildUpdateXml({ PurposeId, Code, Name });

		const result = await executeProcedureXml('Purpose_Update_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error updating purpose: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed updating purpose: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Purpose updated',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during updating purpose: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
