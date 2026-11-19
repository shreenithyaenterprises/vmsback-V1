import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../utils/imports.js';
import { buildTemplateToggleXml } from './prebooking.utils.js';

export const togglePrebookingTemplate = async (req, res, next) => {
	try {
		logger.info('togglePrebookingTemplate API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.PrebookingTemplateIdRule,
			RequiredRules.PrebookingTemplateIsActiveRule,
		]);
		if (errorResponse) return;

		const { TemplateId, IsActive } = req.body;
		const xmlData = buildTemplateToggleXml({ TemplateId, IsActive });

		const result = await executeProcedureXml('Prebooking_Template_Toggle_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error toggling template: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed toggling template: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Template status updated',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during toggling template: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
