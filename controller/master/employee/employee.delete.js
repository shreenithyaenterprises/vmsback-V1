import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildDeleteXml } from './employee.utils.js';

export const deleteEmployee = async (req, res, next) => {
	try {
		logger.info('deleteEmployee API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.EmployeeIdRule,
		]);
		if (errorResponse) return;

		const { EmployeeId } = req.body || {};
		const resolvedId = EmployeeId ?? req.query?.EmployeeId;
		if (!resolvedId) {
			logger.error('EmployeeId is required for delete');
			return next(createError(STATUS_CODES.BAD_REQUEST, 'EmployeeId is required'));
		}
		const xmlData = buildDeleteXml({ EmployeeId: resolvedId });

		const result = await executeProcedureXml('Employee_Delete_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error deleting employee: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed deleting employee: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Employee deleted',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during deleting employee: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
