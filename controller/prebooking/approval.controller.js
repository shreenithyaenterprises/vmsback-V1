import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	validateRequest,
	RequiredRules,
	executeProcedureXml,
	getDatabaseByTarget,
	sql,
} from '../../utils/imports.js';
import QRCode from 'qrcode';
import { sendMail } from '../../utils/mailer.js';
import { isValidApprovalActionToken } from '../../utils/approvalActionToken.js';

const escapeHtml = (value = '') =>
	String(value).replace(/[&<>"']/g, (ch) => {
		switch (ch) {
			case '&':
				return '&amp;';
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '"':
				return '&quot;';
			case "'":
				return '&#39;';
			default:
				return ch;
		}
	});

const resolveApproverEmployeeId = async (user) => {
	const raw = user?.id ?? user?.userId;
	if (!raw) return null;

	const numeric = Number(raw);
	if (Number.isFinite(numeric) && numeric > 0) {
		return numeric;
	}

	const pool = await getDatabaseByTarget('main');
	if (!pool) {
		return null;
	}

	const request = pool.request();
	request.input('UserId', sql.NVarChar(160), String(raw));

	const result = await request.query(`
		SELECT TOP 1 employee_id AS EmployeeId
		FROM dbo.employee_master
		WHERE is_active = 1
		  AND (
			email = @UserId
			OR mobile = @UserId
		  )
	`);

	const employeeId = result?.recordset?.[0]?.EmployeeId;
	return employeeId ? Number(employeeId) : null;
};

/**
 * GET APPROVAL AUTHORITY
 * Determines who should approve based on:
 * 1. Employee-wise rule (APPROVAL_AUTHORITY_MASTER)
 * 2. Visitor-type rule (APPROVAL_RULE_MASTER) - fallback
 */
export const getApprovalAuthority = async (req, res, next) => {
	try {
		logger.info('getApprovalAuthority API called');

		const { HostEmployeeId, VisitorTypeCode } = req.body;

		if (!HostEmployeeId) {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, 'HostEmployeeId is required')
			);
		}

		const xmlData = `<ApprovalRequest>
			<HostEmployeeId>${HostEmployeeId}</HostEmployeeId>
			<VisitorTypeCode>${VisitorTypeCode || ''}</VisitorTypeCode>
		</ApprovalRequest>`;

		const result = await executeProcedureXml(
			'GetApprovalAuthority_SP',
			'main',
			xmlData
		);

		if (!result.success) {
			logger.error(`Error fetching approval authority: ${result?.error}`);
			return next(
				createError(
					STATUS_CODES.SERVER_ERROR,
					result?.error || STATUS_MESSAGES.SERVER_ERROR
				)
			);
		}

		const approvalData = result?.data;

		if (approvalData?.Success === 'E') {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, approvalData?.Message)
			);
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: approvalData?.Message || 'Approval authority fetched',
			data: {
				approverId: approvalData?.ApproverId,
				approverName: approvalData?.ApproverName,
				approverEmail: approvalData?.ApproverEmail,
				approvalLevel: approvalData?.ApprovalLevel,
				requiresApproval: approvalData?.ApproverId !== null,
			},
		});
	} catch (error) {
		logger.error(`Error in getApprovalAuthority: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

/**
 * CREATE APPROVAL RECORD
 * Creates a pending approval record when visitor fills form
 */
export const createApprovalRecord = async (req, res, next) => {
	try {
		logger.info('createApprovalRecord API called');

		const { prebookingId, approverId, approvalLevel } = req.body;

		if (!prebookingId || !approverId) {
			return next(
				createError(
					STATUS_CODES.BAD_REQUEST,
					'prebookingId and approverId are required'
				)
			);
		}

		const xmlData = `<ApprovalRecord>
			<PrebookingId>${prebookingId}</PrebookingId>
			<ApproverId>${approverId}</ApproverId>
			<ApprovalLevel>${approvalLevel || 1}</ApprovalLevel>
		</ApprovalRecord>`;

		const result = await executeProcedureXml(
			'CreateApprovalRecord_SP',
			'main',
			xmlData
		);

		if (!result.success || result?.data?.Success === 'E') {
			logger.error(`Error creating approval record: ${result?.error}`);
			return next(
				createError(
					STATUS_CODES.SERVER_ERROR,
					result?.data?.Message || STATUS_MESSAGES.SERVER_ERROR
				)
			);
		}

		return res.status(STATUS_CODES.CREATED).json({
			success: true,
			message: 'Approval record created',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`Error in createApprovalRecord: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

/**
 * SUBMIT APPROVAL DECISION
 * Approver accepts or rejects the visit
 */
export const submitApprovalDecision = async (req, res, next) => {
	try {
		logger.info('submitApprovalDecision API called');

		const { approvalLogId, action, remarks } = req.body;

		if (!approvalLogId || !action) {
			return next(
				createError(
					STATUS_CODES.BAD_REQUEST,
					'approvalLogId and action are required'
				)
			);
		}

		if (!['APPROVED', 'REJECTED'].includes(action)) {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, 'Action must be APPROVED or REJECTED')
			);
		}

		// Escape XML special characters in remarks to prevent XML injection
		const escapedRemarks = (remarks || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');

		const xmlData = `<ApprovalDecision>
			<ApprovalLogId>${approvalLogId}</ApprovalLogId>
			<Action>${action}</Action>
			<Remarks>${escapedRemarks}</Remarks>
		</ApprovalDecision>`;

		const result = await executeProcedureXml(
			'SubmitApprovalDecision_SP',
			'main',
			xmlData
		);

		if (!result.success || result?.data?.Success === 'E') {
			logger.error(`Error submitting approval decision: ${result?.error}`);
			return next(
				createError(
					STATUS_CODES.SERVER_ERROR,
					result?.data?.Message || STATUS_MESSAGES.SERVER_ERROR
				)
			);
		}

		const approvalData = result?.data;
		const prebookingId = approvalData?.PrebookingId;

		if (action === 'REJECTED' && prebookingId) {
			try {
				const pool = await getDatabaseByTarget('main');
				const rejectSyncRequest = pool.request();
				rejectSyncRequest.input('PrebookingId', sql.Int, Number(prebookingId));
				await rejectSyncRequest.query(`
					UPDATE dbo.VISIT_TRANSACTION
					SET ApprovalStatus = 'REJECTED',
						VisitStatus = 'REJECTED',
						UpdatedAt = GETDATE()
					WHERE PreBookingID = @PrebookingId
				`);
			} catch (rejectSyncError) {
				logger.error(`Error syncing rejected visit transaction status: ${rejectSyncError}`);
			}
		}

		// If APPROVED, create visit transaction and send gate pass email
		if (action === 'APPROVED' && prebookingId) {
			try {
				logger.info(`Creating visit transaction for prebooking ${prebookingId}`);

				// Create visit transaction
				const visitXml = `<VisitRequest><PreBookingID>${prebookingId}</PreBookingID></VisitRequest>`;
				const visitResult = await executeProcedureXml('CreateVisitTransaction_SP', 'main', visitXml);

				if (visitResult?.success && visitResult?.data?.Success === 'S') {
					const visitID = visitResult.data.VisitID;
					const referenceCode = visitResult.data.ReferenceCode;

					// Generate QR code as buffer (for email attachment)
					const qrCodeBuffer = await QRCode.toBuffer(referenceCode, {
						errorCorrectionLevel: 'H',
						type: 'png',
						width: 300,
					});

					// Get visitor details
					const pool = await getDatabaseByTarget('main');
					const request = pool.request();
					request.input('PrebookingId', sql.Int, prebookingId);

					const visitorQuery = await request.query(`
						SELECT 
							ps.visitor_name, 
							ps.visitor_email,
							ps.visit_date,
							ps.visit_time_slot,
							em.name AS host_name,
							dm.name AS department_name
						FROM dbo.prebooking_submission ps
						LEFT JOIN dbo.prebooking_request pr ON ps.prebooking_id = pr.prebooking_id
						LEFT JOIN dbo.employee_master em ON pr.host_employee_id = em.employee_id
						LEFT JOIN dbo.department_master dm ON pr.department_id = dm.department_id
						WHERE ps.prebooking_id = @PrebookingId
					`);

					const visitor = visitorQuery?.recordset?.[0];

					if (visitor && visitor.visitor_email) {
						// Send gate pass email
						const emailSubject = 'Your Visitor Entry Gate Pass - Premium VMS';
						const emailHtml = `
							<html>
							<body style="font-family: Arial, sans-serif; background-color: #f5f5f5;">
								<div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px;">
									<div style="text-align: center; border-bottom: 2px solid #2c3e50; padding-bottom: 20px;">
										<h2 style="color: #2c3e50; margin: 0;">VISITOR ENTRY PASS</h2>
										<p style="color: #7f8c8d; margin: 5px 0;">Reference: ${referenceCode}</p>
									</div>
									
									<div style="margin-top: 20px;">
										<h3 style="color: #2c3e50; border-bottom: 1px solid #bdc3c7; padding-bottom: 10px;">Visitor Information</h3>
										<table style="width: 100%; border-collapse: collapse;">
											<tr>
												<td style="padding: 10px; font-weight: bold; width: 30%;">Name:</td>
												<td style="padding: 10px;">${visitor.visitor_name}</td>
											</tr>
											<tr>
												<td style="padding: 10px; font-weight: bold;">Email:</td>
												<td style="padding: 10px;">${visitor.visitor_email}</td>
											</tr>
										</table>
									</div>
									
									<div style="margin-top: 20px;">
										<h3 style="color: #2c3e50; border-bottom: 1px solid #bdc3c7; padding-bottom: 10px;">Visit Details</h3>
										<table style="width: 100%; border-collapse: collapse;">
											<tr>
												<td style="padding: 10px; font-weight: bold; width: 30%;">Host Name:</td>
												<td style="padding: 10px;">${visitor.host_name || 'N/A'}</td>
											</tr>
											<tr>
												<td style="padding: 10px; font-weight: bold;">Department:</td>
												<td style="padding: 10px;">${visitor.department_name || 'N/A'}</td>
											</tr>
											<tr>
												<td style="padding: 10px; font-weight: bold;">Visit Date:</td>
												<td style="padding: 10px;">${new Date(visitor.visit_date).toLocaleDateString()}</td>
											</tr>
											<tr>
												<td style="padding: 10px; font-weight: bold;">Time Slot:</td>
												<td style="padding: 10px;">${visitor.visit_time_slot || 'N/A'}</td>
											</tr>
										</table>
									</div>
									
									<div style="margin-top: 30px; text-align: center; background-color: #f0f0f0; padding: 20px; border-radius: 8px;">
										<p style="color: #7f8c8d; margin-top: 0;">Please present this QR code at the gate</p>
										<div style="margin: 20px 0;">
											<img src="cid:qrcode" alt="QR Code" style="width: 250px; height: 250px; display: block; margin: 0 auto;" />
										</div>
										<p style="font-size: 14px; color: #34495e; margin: 10px 0;">
											<strong>Or mention this code:</strong><br>
											<span style="font-size: 18px; letter-spacing: 2px; font-weight: bold;">${referenceCode}</span>
										</p>
									</div>
									
									<div style="margin-top: 20px; background-color: #fff3cd; padding: 15px; border-left: 4px solid #ff9800; border-radius: 4px;">
										<p style="margin: 0; color: #856404;">
											<strong>⚠️ Important:</strong><br>
											• This pass is valid only on ${new Date(visitor.visit_date).toLocaleDateString()}<br>
											• Please arrive 10 minutes before scheduled time<br>
											• Carry a valid ID proof<br>
											• Comply with all facility safety norms
										</p>
									</div>
									
									<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #bdc3c7; text-align: center; color: #7f8c8d; font-size: 12px;">
										<p>Premium VMS - Visitor Management System</p>
										<p>This is an automated message. Please do not reply to this email.</p>
									</div>
								</div>
							</body>
							</html>
						`;

						await sendMail({
							to: visitor.visitor_email,
							subject: emailSubject,
							html: emailHtml,
							attachments: [
								{
									filename: 'qrcode.png',
									content: qrCodeBuffer,
									cid: 'qrcode' // Content-ID for inline embedding
								}
							]
						});

						logger.info(`Gate pass email sent to ${visitor.visitor_email}`);
					}
				}
			} catch (emailError) {
				// Log error but don't fail the approval
				logger.error(`Error sending gate pass email: ${emailError}`);
			}
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: `Visit ${action.toLowerCase()} successfully`,
			data: result?.data,
		});
	} catch (error) {
		logger.error(`Error in submitApprovalDecision: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

export const submitPublicApprovalDecision = async (req, res, next) => {
	try {
		logger.info('submitPublicApprovalDecision API called');

		const approvalLogId = Number(req.query.approvalLogId || req.body?.approvalLogId);
		const action = String(req.query.action || req.body?.action || '').toUpperCase();
		const token = req.query.token || req.body?.token;
		const remarks = String(req.body?.remarks || '').trim();

		const renderHtml = (title, message, color = '#166534') =>
			res.status(STATUS_CODES.OK).send(`
				<!doctype html>
				<html>
					<head>
						<meta charset="utf-8" />
						<meta name="viewport" content="width=device-width, initial-scale=1" />
						<title>${title}</title>
					</head>
					<body style="margin:0;font-family:Arial,sans-serif;background:#f8fafc;color:#111827;">
						<div style="max-width:560px;margin:64px auto;padding:28px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;text-align:center;">
							<h2 style="margin:0 0 12px;color:${color};">${title}</h2>
							<p style="margin:0;font-size:16px;line-height:1.5;">${message}</p>
						</div>
					</body>
				</html>
			`);

		const renderRejectRemarkForm = (errorMessage = '') =>
			res.status(STATUS_CODES.OK).send(`
				<!doctype html>
				<html>
					<head>
						<meta charset="utf-8" />
						<meta name="viewport" content="width=device-width, initial-scale=1" />
						<title>Reject visitor request</title>
					</head>
					<body style="margin:0;font-family:Arial,sans-serif;background:#f8fafc;color:#111827;">
						<div style="max-width:560px;margin:40px auto;padding:28px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;">
							<h2 style="margin:0 0 10px;color:#991b1b;text-align:center;">Reject visitor request</h2>
							<p style="margin:0 0 20px;font-size:15px;line-height:1.5;text-align:center;color:#4b5563;">Please add a rejection remark before submitting.</p>
							${
								errorMessage
									? `<p style="margin:0 0 14px;padding:10px 12px;border-radius:6px;background:#fee2e2;color:#991b1b;font-size:14px;">${escapeHtml(
											errorMessage
										)}</p>`
									: ''
							}
							<form method="post" action="/api/prebooking/public/approval/decision">
								<input type="hidden" name="approvalLogId" value="${escapeHtml(approvalLogId)}" />
								<input type="hidden" name="action" value="REJECTED" />
								<input type="hidden" name="token" value="${escapeHtml(token)}" />
								<label for="remarks" style="display:block;margin-bottom:8px;font-size:14px;font-weight:700;color:#374151;">Remark</label>
								<textarea id="remarks" name="remarks" rows="5" required maxlength="500" placeholder="Enter rejection reason" style="width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:6px;padding:12px;font-size:15px;line-height:1.4;resize:vertical;">${escapeHtml(
									remarks
								)}</textarea>
								<button type="submit" style="width:100%;margin-top:18px;border:0;border-radius:6px;background:#dc2626;color:white;padding:12px 16px;font-size:16px;font-weight:700;cursor:pointer;">Submit Rejection</button>
							</form>
						</div>
					</body>
				</html>
			`);

		if (!Number.isFinite(approvalLogId) || approvalLogId <= 0) {
			return renderHtml('Invalid approval link', 'The approval link is missing request information.', '#991b1b');
		}

		if (!['APPROVED', 'REJECTED'].includes(action)) {
			return renderHtml('Invalid approval action', 'This approval link has an unsupported action.', '#991b1b');
		}

		if (!isValidApprovalActionToken(approvalLogId, action, token)) {
			return renderHtml('Invalid approval link', 'This approval link could not be verified.', '#991b1b');
		}

		const pool = await getDatabaseByTarget('main');
		const checkRequest = pool.request();
		checkRequest.input('ApprovalLogId', sql.Int, approvalLogId);
		const checkResult = await checkRequest.query(`
			SELECT TOP 1 action
			FROM dbo.visit_approval_log
			WHERE approval_log_id = @ApprovalLogId
		`);

		const currentAction = checkResult?.recordset?.[0]?.action;
		if (!currentAction) {
			return renderHtml('Approval not found', 'This approval request was not found.', '#991b1b');
		}

		if (currentAction !== 'PENDING') {
			return renderHtml('Already processed', `This request is already ${String(currentAction).toLowerCase()}.`, '#92400e');
		}

		if (action === 'REJECTED') {
			if (req.method === 'GET') {
				return renderRejectRemarkForm();
			}

			if (!remarks) {
				return renderRejectRemarkForm('Remark is required for rejection.');
			}
		}

		req.body = {
			approvalLogId,
			action,
			remarks: action === 'REJECTED' ? remarks : 'Action submitted from approval email',
		};

		const publicResponse = Object.create(res);
		publicResponse.status = (statusCode) => {
			res.status(statusCode);
			return publicResponse;
		};
		publicResponse.json = () =>
			renderHtml(
				action === 'APPROVED' ? 'Request approved' : 'Request rejected',
				action === 'APPROVED'
					? 'The visitor request has been approved successfully. The gate pass email will be sent to the visitor.'
					: 'The visitor request has been rejected successfully.'
			);

		return submitApprovalDecision(req, publicResponse, next);
	} catch (error) {
		logger.error(`Error in submitPublicApprovalDecision: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

/**
 * GET APPROVAL STATUS
 * Fetch approval history for a prebooking request
 */
export const getApprovalStatus = async (req, res, next) => {
	try {
		logger.info('getApprovalStatus API called');

		const { prebookingId } = req.query;

		if (!prebookingId) {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, 'prebookingId is required')
			);
		}

		const xmlData = `<ApprovalRequest>
			<PrebookingId>${prebookingId}</PrebookingId>
		</ApprovalRequest>`;

		const result = await executeProcedureXml(
			'GetApprovalStatus_SP',
			'main',
			xmlData
		);

		if (!result.success) {
			logger.error(`Error fetching approval status: ${result?.error}`);
			return next(
				createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR)
			);
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: 'Approval status fetched',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`Error in getApprovalStatus: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

/**
 * GET PENDING APPROVALS FOR CURRENT USER
 * Fetch all pending approvals assigned to the logged-in user
 */
export const getPendingApprovals = async (req, res, next) => {
	try {
		logger.info('getPendingApprovals API called');

		const approverId = await resolveApproverEmployeeId(req.user);

		if (!req.user?.id && !req.user?.userId) {
			return next(
				createError(STATUS_CODES.UNAUTHORIZED, 'User not authenticated')
			);
		}

		if (!Number.isFinite(approverId) || approverId <= 0) {
			return res.status(STATUS_CODES.OK).json({
				success: true,
				message:
					'No employee mapping found for logged-in user. Returning empty pending approvals.',
				data: {
					ApprovalRequests: [],
				},
			});
		}

		const xmlData = `<ApprovalRequest>
			<ApproverId>${approverId}</ApproverId>
		</ApprovalRequest>`;

		const result = await executeProcedureXml(
			'GetPendingApprovals_SP',
			'main',
			xmlData
		);

		if (!result.success) {
			logger.error(`Error fetching pending approvals: ${result?.error}`);

			if (result?.errorType === 'E') {
				return next(
					createError(
						STATUS_CODES.BAD_REQUEST,
						result?.error || 'Unable to fetch pending approvals'
					)
				);
			}

			return next(
				createError(
					STATUS_CODES.SERVER_ERROR,
					result?.error || STATUS_MESSAGES.SERVER_ERROR
				)
			);
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: 'Pending approvals fetched',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`Error in getPendingApprovals: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};
