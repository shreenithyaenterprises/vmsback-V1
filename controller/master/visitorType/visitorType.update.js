import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildUpdateXml } from './visitorType.utils.js';

export const updateVisitorType = async (req, res, next) => {
	try {
		logger.info('updateVisitorType API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.VisitorTypeIdRule,
			RequiredRules.VisitorTypeCodeRule,
			RequiredRules.VisitorTypeNameRule,
		]);
		if (errorResponse) return;

		const { VisitorTypeId, Code, Name } = req.body;
		const xmlData = buildUpdateXml({ VisitorTypeId, Code, Name });

		const result = await executeProcedureXml(
			'VisitorType_Update_SP',
			'main',
			xmlData
		);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error updating visitor type: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed updating visitor type: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Visitor type updated',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during updating visitor type: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
