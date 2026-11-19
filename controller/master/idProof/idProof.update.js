import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildUpdateXml } from './idProof.utils.js';

export const updateIdProof = async (req, res, next) => {
	try {
		logger.info('updateIdProof API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.IdProofIdRule,
			RequiredRules.IdProofNameRule,
		]);
		if (errorResponse) return;

		const { IdProofId, Name } = req.body;
		const xmlData = buildUpdateXml({ IdProofId, Name });

		const result = await executeProcedureXml('IdProof_Update_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error updating id proof: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed updating id proof: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Id proof updated',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during updating id proof: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
