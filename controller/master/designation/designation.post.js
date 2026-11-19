import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildCreateXml } from './designation.utils.js';

export const createDesignation = async (req, res, next) => {
	try {
		logger.info('createDesignation API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.DesignationNameRule,
		]);
		if (errorResponse) return;

		const { Name } = req.body;
		const xmlData = buildCreateXml({ Name });

		const result = await executeProcedureXml('Designation_Create_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error creating designation: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed creating designation: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.CREATED).json({
			success: true,
			message: result?.data?.Message || 'Designation created',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during creating designation: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
