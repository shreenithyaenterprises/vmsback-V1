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

/**
 * CREATE EMPLOYEE WITH AUTO USER CREATION
 * Creates an employee and automatically generates login credentials
 * Returns: Employee details + UserId + Generated Password
 */
export const createEmployeeWithUser = async (req, res, next) => {
	try {
		logger.info('createEmployeeWithUser API called');

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
			CreateUser = true, // Default: create user automatically
		} = req.body;

		// Build XML with CreateUser flag
		const xmlData = `<Employee>
			<Name>${Name}</Name>
			<Department>${Department}</Department>
			<DepartmentId>${DepartmentId}</DepartmentId>
			<Designation>${Designation}</Designation>
			<Mobile>${Mobile}</Mobile>
			<Email>${Email}</Email>
			<IsDepartmentHead>${IsDepartmentHead || false}</IsDepartmentHead>
			<ApprovalRequired>${ApprovalRequired || false}</ApprovalRequired>
			<CreateUser>${CreateUser}</CreateUser>
		</Employee>`;

		// Call the new stored procedure
		const result = await executeProcedureXml(
			'Employee_Create_SP_WithUser',
			'main',
			xmlData
		);

		if (!result.success || result?.data?.Success === 'E') {
			logger.error(`Error creating employee with user: ${result?.error || result?.data?.Message}`);
			return next(
				createError(
					STATUS_CODES.CONFLICT,
					result?.data?.Message || result?.error || STATUS_MESSAGES.SERVER_ERROR
				)
			);
		}

		const responseData = result?.data;

		// Log the generated credentials for admin notification
		if (responseData?.UserId && responseData?.GeneratedPassword) {
			logger.info(`Employee created - User: ${responseData.UserId}, Password: ${responseData.GeneratedPassword}`);
		}

		return res.status(STATUS_CODES.CREATED).json({
			success: true,
			message: responseData?.Message || 'Employee and user created successfully',
			data: {
				employeeId: responseData?.EmployeeId,
				userId: responseData?.UserId,
				generatedPassword: responseData?.GeneratedPassword,
				role: responseData?.Role,
				userStatus: responseData?.UserStatus,
			},
		});
	} catch (error) {
		logger.error(`Error in createEmployeeWithUser: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};
