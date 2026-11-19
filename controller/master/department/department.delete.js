import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildDeleteXml } from './department.utils.js';

export const deleteDepartment = async (req, res, next) => {
	try {
		logger.info('deleteDepartment API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.DepartmentIdRule,
		]);
		if (errorResponse) return;

		const { DepartmentId } = req.body || {};
		const resolvedId = DepartmentId ?? req.query?.DepartmentId;
		if (!resolvedId) {
			logger.error('DepartmentId is required for delete');
			return next(createError(STATUS_CODES.BAD_REQUEST, 'DepartmentId is required'));
		}
		const xmlData = buildDeleteXml({ DepartmentId: resolvedId });

		const result = await executeProcedureXml('Department_Delete_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error deleting department: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed deleting department: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Department deleted',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during deleting department: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
