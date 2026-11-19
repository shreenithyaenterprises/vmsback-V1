import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildGetXml } from './idProof.utils.js';

export const getIdProofs = async (req, res, next) => {
	try {
		logger.info('getIdProofs API called');

		const { IdProofId } = req.body || {};
		const xmlData = buildGetXml({ IdProofId });

		const result = await executeProcedureXml('IdProof_Get_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error fetching id proofs: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed fetching id proofs: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Id proofs fetched',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during fetching id proofs: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
