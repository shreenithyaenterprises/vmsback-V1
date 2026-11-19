import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildCreateXml } from './timePolicy.utils.js';

export const createTimePolicy = async (req, res, next) => {
	try {
		logger.info('createTimePolicy API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.TimePolicyVisitorTypeRule,
			RequiredRules.TimePolicyLabelRule,
		]);
		if (errorResponse) return;

		const { VisitorTypeCode, PolicyLabel } = req.body;
		const xmlData = buildCreateXml({ VisitorTypeCode, PolicyLabel });

		const result = await executeProcedureXml(
			'TimePolicy_Create_SP',
			'main',
			xmlData
		);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error creating time policy: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed creating time policy: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.CREATED).json({
			success: true,
			message: result?.data?.Message || 'Time policy created',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during creating time policy: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
