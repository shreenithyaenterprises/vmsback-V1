import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildCreateXml } from './idProof.utils.js';

export const createIdProof = async (req, res, next) => {
	try {
		logger.info('createIdProof API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.IdProofNameRule,
		]);
		if (errorResponse) return;

		const { Name } = req.body;
		const xmlData = buildCreateXml({ Name });

		const result = await executeProcedureXml('IdProof_Create_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error creating id proof: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed creating id proof: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.CREATED).json({
			success: true,
			message: result?.data?.Message || 'Id proof created',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during creating id proof: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
