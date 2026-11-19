import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildUpdateXml } from './employee.utils.js';

export const updateEmployee = async (req, res, next) => {
	try {
		logger.info('updateEmployee API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.EmployeeIdRule,
			RequiredRules.EmployeeNameRule,
			RequiredRules.EmployeeDepartmentRule,
			RequiredRules.EmployeeDepartmentIdRule,
			RequiredRules.EmployeeDesignationRule,
			RequiredRules.EmployeeMobileRule,
			RequiredRules.EmployeeEmailRule,
			RequiredRules.EmployeeApprovalRequiredRule,
		]);
		if (errorResponse) return;

		const {
			EmployeeId,
			Name,
			Department,
			DepartmentId,
			Designation,
			Mobile,
			Email,
			IsDepartmentHead,
			ApprovalRequired,
		} = req.body;
		const xmlData = buildUpdateXml({
			EmployeeId,
			Name,
			Department,
			DepartmentId,
			Designation,
			Mobile,
			Email,
			IsDepartmentHead,
			ApprovalRequired,
		});

		const result = await executeProcedureXml('Employee_Update_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error updating employee: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed updating employee: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Employee updated',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during updating employee: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
