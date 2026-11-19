import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildGetXml } from './designation.utils.js';

export const getDesignations = async (req, res, next) => {
	try {
		logger.info('getDesignations API called');

		const { DesignationId: bodyDesignationId } = req.body || {};
		const { DesignationId: queryDesignationId } = req.query || {};
		const DesignationId = bodyDesignationId ?? queryDesignationId;
		const xmlData = buildGetXml({ DesignationId });

		const result = await executeProcedureXml('Designation_Get_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error fetching designations: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed fetching designations: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Designations fetched',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during fetching designations: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
