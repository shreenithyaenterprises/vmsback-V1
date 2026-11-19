import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildDeleteXml } from './designation.utils.js';

export const deleteDesignation = async (req, res, next) => {
	try {
		logger.info('deleteDesignation API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.DesignationIdRule,
		]);
		if (errorResponse) return;

		const { DesignationId } = req.body || {};
		const resolvedId = DesignationId ?? req.query?.DesignationId;
		if (!resolvedId) {
			logger.error('DesignationId is required for delete');
			return next(createError(STATUS_CODES.BAD_REQUEST, 'DesignationId is required'));
		}
		const xmlData = buildDeleteXml({ DesignationId: resolvedId });

		const result = await executeProcedureXml('Designation_Delete_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error deleting designation: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed deleting designation: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Designation deleted',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during deleting designation: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
