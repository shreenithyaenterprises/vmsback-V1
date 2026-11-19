import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../utils/imports.js';
import { buildTemplateCreateXml } from './prebooking.utils.js';

export const createPrebookingTemplate = async (req, res, next) => {
	try {
		logger.info('createPrebookingTemplate API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.PrebookingTemplateCodeRule,
			RequiredRules.PrebookingTemplateSubjectRule,
			RequiredRules.PrebookingTemplateBodyRule,
		]);
		if (errorResponse) return;

		const { TemplateCode, Subject, BodyHtml } = req.body;
		const xmlData = buildTemplateCreateXml({ TemplateCode, Subject, BodyHtml });

		const result = await executeProcedureXml('Prebooking_Template_Create_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error creating template: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed creating template: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.CREATED).json({
			success: true,
			message: result?.data?.Message || 'Template created',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during creating template: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
