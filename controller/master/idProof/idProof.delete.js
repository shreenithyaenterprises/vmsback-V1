import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildDeleteXml } from './idProof.utils.js';

export const deleteIdProof = async (req, res, next) => {
	try {
		logger.info('deleteIdProof API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.IdProofIdRule,
		]);
		if (errorResponse) return;

		const { IdProofId } = req.body || {};
		const resolvedId = IdProofId ?? req.query?.IdProofId;
		if (!resolvedId) {
			logger.error('IdProofId is required for delete');
			return next(createError(STATUS_CODES.BAD_REQUEST, 'IdProofId is required'));
		}
		const xmlData = buildDeleteXml({ IdProofId: resolvedId });

		const result = await executeProcedureXml('IdProof_Delete_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error deleting id proof: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed deleting id proof: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Id proof deleted',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during deleting id proof: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
