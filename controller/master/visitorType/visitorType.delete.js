import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildDeleteXml } from './visitorType.utils.js';

export const deleteVisitorType = async (req, res, next) => {
	try {
		logger.info('deleteVisitorType API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.VisitorTypeIdRule,
		]);
		if (errorResponse) return;

		const { VisitorTypeId } = req.body || {};
		const resolvedId = VisitorTypeId ?? req.query?.VisitorTypeId;
		if (!resolvedId) {
			logger.error('VisitorTypeId is required for delete');
			return next(createError(STATUS_CODES.BAD_REQUEST, 'VisitorTypeId is required'));
		}
		const xmlData = buildDeleteXml({ VisitorTypeId: resolvedId });

		const result = await executeProcedureXml(
			'VisitorType_Delete_SP',
			'main',
			xmlData
		);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error deleting visitor type: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed deleting visitor type: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Visitor type deleted',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during deleting visitor type: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
