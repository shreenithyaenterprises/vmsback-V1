import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../utils/imports.js';
import { buildTemplateUpdateXml } from './prebooking.utils.js';

export const updatePrebookingTemplate = async (req, res, next) => {
	try {
		logger.info('updatePrebookingTemplate API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.PrebookingTemplateIdRule,
			RequiredRules.PrebookingTemplateSubjectRule,
			RequiredRules.PrebookingTemplateBodyRule,
		]);
		if (errorResponse) return;

		const { TemplateId, Subject, BodyHtml } = req.body;
		const xmlData = buildTemplateUpdateXml({ TemplateId, Subject, BodyHtml });

		const result = await executeProcedureXml('Prebooking_Template_Update_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error updating template: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed updating template: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Template updated',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during updating template: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
