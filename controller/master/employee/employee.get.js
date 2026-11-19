import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildGetXml } from './employee.utils.js';

export const getEmployees = async (req, res, next) => {
	try {
		logger.info('getEmployees API called');

		// Support both body (POST) and query (GET) parameters
		const { EmployeeId: bodyEmployeeId } = req.body || {};
		const { EmployeeId: queryEmployeeId } = req.query || {};
		const { approval_required } = req.query || {};
		const EmployeeId = bodyEmployeeId ?? queryEmployeeId;

		const xmlData = buildGetXml({ EmployeeId });

		const result = await executeProcedureXml('Employee_Get_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error fetching employees: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed fetching employees: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		// Filter by approval_required if parameter is provided
		let employees = result?.data?.Items || [];
		
		// Parse Items if it's a JSON string
		if (typeof employees === 'string') {
			try {
				employees = JSON.parse(employees);
			} catch (e) {
				employees = [];
			}
		}
		
		// Ensure employees is an array
		if (!Array.isArray(employees)) {
			employees = [];
		}
		
		// Only filter by approval_required if the query parameter is explicitly provided
		if (approval_required !== undefined && approval_required !== '') {
			const approvalRequiredBool = approval_required === 'true' || approval_required === '1';
			employees = employees.filter(emp => emp.ApprovalRequired === approvalRequiredBool);
		}

		// Convert camelCase to match frontend expectations (optional - can also update JSX)
		const formattedEmployees = employees.map(emp => ({
			employee_id: emp.EmployeeId,
			name: emp.Name,
			department: emp.Department,
			department_id: emp.DepartmentId,
			designation: emp.Designation,
			mobile: emp.Mobile,
			email: emp.Email,
			is_department_head: emp.IsDepartmentHead,
			approval_required: emp.ApprovalRequired,
			is_active: emp.IsActive
		}));

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Employees fetched',
			data: formattedEmployees,
		});
	} catch (error) {
		logger.error(`There was an error during fetching employees: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
