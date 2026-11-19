import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildUpdateXml } from './designation.utils.js';

export const updateDesignation = async (req, res, next) => {
	try {
		logger.info('updateDesignation API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.DesignationIdRule,
			RequiredRules.DesignationNameRule,
		]);
		if (errorResponse) return;

		const { DesignationId, Name } = req.body;
		const xmlData = buildUpdateXml({ DesignationId, Name });

		const result = await executeProcedureXml('Designation_Update_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error updating designation: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed updating designation: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Designation updated',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during updating designation: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
