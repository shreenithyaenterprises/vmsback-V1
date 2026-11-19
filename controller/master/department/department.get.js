import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	executeProcedureXml,
} from '../../../utils/imports.js';
import { buildGetXml } from './department.utils.js';

export const getDepartments = async (req, res, next) => {
	try {
		logger.info('getDepartments API called');

		const { DepartmentId: bodyDepartmentId } = req.body || {};
		const { DepartmentId: queryDepartmentId } = req.query || {};
		const DepartmentId = bodyDepartmentId ?? queryDepartmentId;
		const xmlData = buildGetXml({ DepartmentId });

		const result = await executeProcedureXml('Department_Get_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error fetching departments: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed fetching departments: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Departments fetched',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`There was an error during fetching departments: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
