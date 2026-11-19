import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	executeProcedureXml,
} from '../../utils/imports.js';
import { buildTemplateListXml } from './prebooking.utils.js';

export const listPrebookingTemplates = async (req, res, next) => {
	try {
		logger.info('listPrebookingTemplates API called');

		const { OnlyActive } = req.body || {};
		const xmlData = buildTemplateListXml({ OnlyActive });

		const result = await executeProcedureXml('Prebooking_Template_List_SP', 'main', xmlData);
		if (!result.success) {
			logger.error(`Stored procedure failed listing templates: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Templates fetched',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during listing templates: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
