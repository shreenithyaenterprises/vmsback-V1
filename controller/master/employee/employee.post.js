import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildCreateXml } from './employee.utils.js';

export const createEmployee = async (req, res, next) => {
	try {
		logger.info('createEmployee API called');

		const errorResponse = await validateRequest(req, res, [
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
			Name,
			Department,
			DepartmentId,
			Designation,
			Mobile,
			Email,
			IsDepartmentHead,
			ApprovalRequired,
			CreateUser = true,
		} = req.body;
		const xmlData = buildCreateXml({
			Name,
			Department,
			DepartmentId,
			Designation,
			Mobile,
			Email,
			IsDepartmentHead,
			ApprovalRequired,
			CreateUser,
		});

		const result = await executeProcedureXml('Employee_Create_SP_WithUser', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error creating employee: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed creating employee: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		// Log generated credentials for admin notification
		if (result?.data?.UserId && result?.data?.GeneratedPassword) {
			logger.info(`Employee created - UserId: ${result?.data?.UserId}, Password: ${result?.data?.GeneratedPassword}`);
		}

		return res.status(STATUS_CODES.CREATED).json({
			success: true,
			message: result?.data?.Message || 'Employee created successfully',
			data: {
				employeeId: result?.data?.EmployeeId,
				userId: result?.data?.UserId,
				generatedPassword: result?.data?.GeneratedPassword,
				role: result?.data?.Role,
				userStatus: result?.data?.UserStatus,
			},
		});
	} catch (error) {
		logger.error(`There was an error during creating employee: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
