import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildCreateXml } from './visitorType.utils.js';

export const createVisitorType = async (req, res, next) => {
	try {
		logger.info('createVisitorType API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.VisitorTypeCodeRule,
			RequiredRules.VisitorTypeNameRule,
		]);
		if (errorResponse) return;

		const { Code, Name } = req.body;
		const xmlData = buildCreateXml({ Code, Name });

		const result = await executeProcedureXml(
			'VisitorType_Create_SP',
			'main',
			xmlData
		);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error creating visitor type: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed creating visitor type: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.CREATED).json({
			success: true,
			message: result?.data?.Message || 'Visitor type created',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during creating visitor type: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
