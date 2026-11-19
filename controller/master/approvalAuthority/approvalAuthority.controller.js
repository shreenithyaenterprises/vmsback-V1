import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
} from '../../../utils/imports.js';

/**
 * CREATE APPROVAL AUTHORITY
 * Assign an approver to an employee (L1, L2, etc.)
 */
export const createApprovalAuthority = async (req, res, next) => {
	try {
		logger.info('createApprovalAuthority API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.EmployeeIdRule,
		]);
		if (errorResponse) return;

		const { EmployeeId, ApproverId, ApprovalLevel } = req.body;

		if (!ApproverId) {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, 'ApproverId is required')
			);
		}

		const xmlData = `<ApprovalAuthority>
			<EmployeeId>${EmployeeId}</EmployeeId>
			<ApproverId>${ApproverId}</ApproverId>
			<ApprovalLevel>${ApprovalLevel || 1}</ApprovalLevel>
		</ApprovalAuthority>`;

		const result = await executeProcedureXml(
			'ApprovalAuthority_Create_SP',
			'main',
			xmlData
		);

		if (!result.success || result?.data?.Success === 'E') {
			logger.error(`Error creating approval authority: ${result?.error}`);
			return next(
				createError(
					STATUS_CODES.CONFLICT,
					result?.data?.Message || STATUS_MESSAGES.SERVER_ERROR
				)
			);
		}

		return res.status(STATUS_CODES.CREATED).json({
			success: true,
			message: 'Approval authority created',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`Error in createApprovalAuthority: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

/**
 * GET APPROVAL AUTHORITIES
 * Fetch approval authorities for a specific employee or all
 */
export const getApprovalAuthorities = async (req, res, next) => {
	try {
		logger.info('getApprovalAuthorities API called');

		const { employeeId } = req.query;

		const xmlData = `<ApprovalAuthority>
			${employeeId ? `<EmployeeId>${employeeId}</EmployeeId>` : ''}
		</ApprovalAuthority>`;

		const result = await executeProcedureXml(
			'ApprovalAuthority_Get_SP',
			'main',
			xmlData
		);

		if (!result.success) {
			logger.error(`Error fetching approval authorities: ${result?.error}`);
			return next(
				createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR)
			);
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Approval authorities fetched',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`Error in getApprovalAuthorities: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

/**
 * DELETE APPROVAL AUTHORITY
 * Remove an approval authority mapping
 */
export const deleteApprovalAuthority = async (req, res, next) => {
	try {
		logger.info('deleteApprovalAuthority API called');

		const { AuthorityId } = req.body;

		if (!AuthorityId) {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, 'AuthorityId is required')
			);
		}

		const xmlData = `<ApprovalAuthority>
			<AuthorityId>${AuthorityId}</AuthorityId>
		</ApprovalAuthority>`;

		const result = await executeProcedureXml(
			'ApprovalAuthority_Delete_SP',
			'main',
			xmlData
		);

		if (!result.success || result?.data?.Success === 'E') {
			logger.error(`Error deleting approval authority: ${result?.error}`);
			return next(
				createError(
					STATUS_CODES.NOT_FOUND,
					result?.data?.Message || STATUS_MESSAGES.SERVER_ERROR
				)
			);
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: 'Approval authority deleted',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`Error in deleteApprovalAuthority: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};
