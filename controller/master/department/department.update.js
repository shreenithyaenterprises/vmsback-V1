import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildUpdateXml } from './department.utils.js';

export const updateDepartment = async (req, res, next) => {
	try {
		logger.info('updateDepartment API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.DepartmentIdRule,
			RequiredRules.DepartmentNameRule,
		]);
		if (errorResponse) return;

		const { DepartmentId, Name } = req.body;
		const xmlData = buildUpdateXml({ DepartmentId, Name });

		const result = await executeProcedureXml('Department_Update_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error updating department: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed updating department: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Department updated',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during updating department: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
