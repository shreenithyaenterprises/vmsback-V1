import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../utils/imports.js';
import { buildTemplateGetXml } from './prebooking.utils.js';

export const getPrebookingTemplate = async (req, res, next) => {
	try {
		logger.info('getPrebookingTemplate API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.PrebookingTemplateCodeRule,
		]);
		if (errorResponse) return;

		const { TemplateCode } = req.body;
		const xmlData = buildTemplateGetXml({ TemplateCode });

		const result = await executeProcedureXml('Prebooking_Template_Get_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error fetching prebooking template: ${result?.error}`);
				return next(createError(STATUS_CODES.NOT_FOUND, result?.error));
			}
			logger.error(`Stored procedure failed fetching prebooking template: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Template fetched',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during fetching prebooking template: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
