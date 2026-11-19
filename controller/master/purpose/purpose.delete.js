import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildDeleteXml } from './purpose.utils.js';

export const deletePurpose = async (req, res, next) => {
	try {
		logger.info('deletePurpose API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.PurposeIdRule,
		]);
		if (errorResponse) return;

		const { PurposeId } = req.body || {};
		const resolvedId = PurposeId ?? req.query?.PurposeId;
		if (!resolvedId) {
			logger.error('PurposeId is required for delete');
			return next(createError(STATUS_CODES.BAD_REQUEST, 'PurposeId is required'));
		}
		const xmlData = buildDeleteXml({ PurposeId: resolvedId });

		const result = await executeProcedureXml('Purpose_Delete_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error deleting purpose: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed deleting purpose: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Purpose deleted',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during deleting purpose: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
