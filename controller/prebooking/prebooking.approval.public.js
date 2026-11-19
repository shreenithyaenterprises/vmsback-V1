import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	getDatabaseByTarget,
	sql,
} from '../../utils/imports.js';

/**
 * PUBLIC: Get approval authority based on employee selection
 * No authentication required - used by public prebooking form
 * Returns who should approve the visit
 */
export const getApprovalAuthorityPublic = async (req, res, next) => {
	try {
		logger.info('getApprovalAuthorityPublic API called');

		const { HostEmployeeId } = req.body;

		if (!HostEmployeeId) {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, 'HostEmployeeId is required')
			);
		}

		const pool = await getDatabaseByTarget('main');
		const request = pool.request();
		request.input('HostEmployeeId', sql.Int, Number(HostEmployeeId));
		const result = await request.query(`
			SELECT TOP 1
				employee_id AS ApproverId,
				name AS ApproverName,
				email AS ApproverEmail
			FROM dbo.employee_master
			WHERE employee_id = @HostEmployeeId
			  AND is_active = 1;
		`);

		const approvalData = result?.recordset?.[0];
		if (!approvalData) {
			return next(createError(STATUS_CODES.BAD_REQUEST, 'Selected employee not found'));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: 'Approval authority fetched',
			data: {
				approverId: approvalData?.ApproverId,
				approverName: approvalData?.ApproverName,
				approverEmail: approvalData?.ApproverEmail,
				approvalLevel: 1,
				requiresApproval: true,
			},
		});
	} catch (error) {
		logger.error(`Error in getApprovalAuthorityPublic: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};
