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
import { sendMail } from '../../utils/mailer.js';
// WhatsApp approval notifications are disabled.
import {
	buildFormSubmitXml,
	buildApprovalQueueLink,
	buildPublicApprovalActionLink,
} from './prebooking.utils.js';
import { createApprovalActionToken } from '../../utils/approvalActionToken.js';

const isValidEmailAddress = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const normalizeEmailRecipients = (email) =>
	String(email || '')
		.split(/[;,]/)
		.map((address) => address.trim())
		.filter(Boolean)
		.filter((address, index, addresses) => addresses.indexOf(address) === index)
		.filter(isValidEmailAddress);

export const submitPrebookingForm = async (req, res, next) => {
	try {
		logger.info('submitPrebookingForm API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.PrebookingTokenRule,
			RequiredRules.PrebookingVisitorNameRule,
			RequiredRules.PrebookingVisitorEmailRule,
			RequiredRules.PrebookingVisitorMobileRule,
			RequiredRules.PrebookingVisitorPhotoRule,
			RequiredRules.PrebookingIdProofIdRule,
			RequiredRules.PrebookingIdProofNumberRule,
			RequiredRules.PrebookingPurposeIdRule,
			RequiredRules.PrebookingHostEmployeeIdRule,
			RequiredRules.PrebookingVisitDateRule,
			RequiredRules.PrebookingVisitTimeSlotRule,
		]);
		if (errorResponse) return;

		const {
			Token,
			VisitorName,
			VisitorEmail,
			VisitorMobile,
			VisitorPhotoBase64,
			IdProofId,
			IdProofNumber,
			PurposeId,
			HostEmployeeId,
			VisitDate,
			VisitTimeSlot,
			CompanyName,
			Address,
			Notes,
		} = req.body;
		const visitorPhotoPath = req.file
			? `/api/uploads/visitor-photos/${req.file.filename}`
			: VisitorPhotoBase64;

		const xmlData = buildFormSubmitXml({
			Token,
			VisitorName,
			VisitorEmail,
			VisitorMobile,
			VisitorPhotoBase64: visitorPhotoPath,
			IdProofId,
			IdProofNumber,
			PurposeId,
			HostEmployeeId,
			VisitDate,
			VisitTimeSlot,
			CompanyName,
			Address,
			Notes,
		});

		const result = await executeProcedureXml('Prebooking_Form_Submit_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error submitting prebooking form: ${result?.error}`);
				return next(createError(STATUS_CODES.CONFLICT, result?.error));
			}
			logger.error(`Stored procedure failed submitting prebooking form: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		let gatePass = null;
		const isAutoApproved = Number(result?.data?.AutoApproved || 0) === 1;
		const prebookingId = Number(result?.data?.PrebookingId || 0);

		if (prebookingId > 0) {
			try {
				const pool = await getDatabaseByTarget('main');

				const selectedHostEmployeeId = Number(HostEmployeeId);
				let intendedApproverId = null;
				if (Number.isInteger(selectedHostEmployeeId) && selectedHostEmployeeId > 0) {
					intendedApproverId = selectedHostEmployeeId;

					const hostUpdateRequest = pool.request();
					hostUpdateRequest.input('PrebookingId', sql.Int, prebookingId);
					hostUpdateRequest.input('HostEmployeeId', sql.Int, selectedHostEmployeeId);
					await hostUpdateRequest.query(`
						UPDATE pr
						SET
							host_employee_id = @HostEmployeeId,
							department_id = COALESCE(em.department_id, pr.department_id)
						FROM dbo.prebooking_request pr
						INNER JOIN dbo.employee_master em
							ON em.employee_id = @HostEmployeeId
							AND em.is_active = 1
						WHERE pr.prebooking_id = @PrebookingId
						  AND (
							pr.host_employee_id IS NULL
							OR pr.host_employee_id <> @HostEmployeeId
						  );
					`);

					const cleanupApprovalRequest = pool.request();
					cleanupApprovalRequest.input('PrebookingId', sql.Int, prebookingId);
					cleanupApprovalRequest.input('IntendedApproverId', sql.Int, intendedApproverId);
					await cleanupApprovalRequest.query(`
						DELETE FROM dbo.visit_approval_log
						WHERE prebooking_id = @PrebookingId
						  AND action = 'PENDING'
						  AND approver_id <> @IntendedApproverId;
					`);
				}

				const approvalRequest = pool.request();
				approvalRequest.input('PrebookingId', sql.Int, prebookingId);
				if (intendedApproverId) {
					approvalRequest.input('IntendedApproverId', sql.Int, intendedApproverId);
				}

				const approvalLogsResult = await approvalRequest.query(`
					SELECT approval_log_id AS ApprovalLogId, approver_id AS ApproverId
					FROM dbo.visit_approval_log
					WHERE prebooking_id = @PrebookingId
					  AND action = 'PENDING'
					  ${intendedApproverId ? 'AND approver_id = @IntendedApproverId' : ''}
				`);

				let approvalLogs = (approvalLogsResult?.recordset || [])
					.map((entry) => ({
						approvalLogId: Number(entry?.ApprovalLogId),
						approverId: Number(entry?.ApproverId),
					}))
					.filter(
						(entry) =>
							Number.isFinite(entry.approvalLogId) &&
							entry.approvalLogId > 0 &&
							Number.isFinite(entry.approverId) &&
							entry.approverId > 0
					);

				if (approvalLogs.length === 0) {
					const fallbackRequest = pool.request();
					fallbackRequest.input('PrebookingId', sql.Int, prebookingId);
					if (intendedApproverId) {
						fallbackRequest.input('IntendedApproverId', sql.Int, intendedApproverId);
					}
					const fallbackResult = await fallbackRequest.query(`
						DECLARE @HostEmployeeId INT;

						SELECT @HostEmployeeId = host_employee_id
						FROM dbo.prebooking_request
						WHERE prebooking_id = @PrebookingId;

						IF ${intendedApproverId ? '1 = 1' : '1 = 0'}
							AND NOT EXISTS (
								SELECT 1
								FROM dbo.visit_approval_log
								WHERE prebooking_id = @PrebookingId
								  AND action = 'PENDING'
							)
						BEGIN
							INSERT INTO dbo.visit_approval_log (
								prebooking_id,
								approval_level,
								approver_id,
								action
							)
							VALUES (
								@PrebookingId,
								1,
								@IntendedApproverId,
								'PENDING'
							);
						END

						IF @HostEmployeeId IS NOT NULL
							AND ${intendedApproverId ? '1 = 0' : '1 = 1'}
							AND NOT EXISTS (
								SELECT 1
								FROM dbo.visit_approval_log
								WHERE prebooking_id = @PrebookingId
								  AND action = 'PENDING'
							)
						BEGIN
							INSERT INTO dbo.visit_approval_log (
								prebooking_id,
								approval_level,
								approver_id,
								action
							)
							SELECT TOP 1
								@PrebookingId,
								aam.approval_level,
								aam.approver_employee_id,
								'PENDING'
							FROM dbo.approval_authority_master aam
							WHERE aam.employee_id = @HostEmployeeId
							  AND aam.is_active = 1
							ORDER BY aam.approval_level ASC;
						END

						IF @HostEmployeeId IS NOT NULL
							AND NOT EXISTS (
								SELECT 1
								FROM dbo.visit_approval_log
								WHERE prebooking_id = @PrebookingId
								  AND action = 'PENDING'
							)
						BEGIN
							INSERT INTO dbo.visit_approval_log (
								prebooking_id,
								approval_level,
								approver_id,
								action
							)
							VALUES (
								@PrebookingId,
								1,
								@HostEmployeeId,
								'PENDING'
							);
						END

						SELECT approval_log_id AS ApprovalLogId, approver_id AS ApproverId
						FROM dbo.visit_approval_log
						WHERE prebooking_id = @PrebookingId
						  AND action = 'PENDING'
						  ${intendedApproverId ? 'AND approver_id = @IntendedApproverId' : ''};
					`);

					approvalLogs = (fallbackResult?.recordset || [])
						.map((entry) => ({
							approvalLogId: Number(entry?.ApprovalLogId),
							approverId: Number(entry?.ApproverId),
						}))
						.filter(
							(entry) =>
								Number.isFinite(entry.approvalLogId) &&
								entry.approvalLogId > 0 &&
								Number.isFinite(entry.approverId) &&
								entry.approverId > 0
						);

					if (approvalLogs.length > 0) {
						logger.info(
							`Approval notification fallback created for prebooking ${prebookingId}`
						);
					}
				}

				for (const approvalLog of approvalLogs) {
					const approverRequest = pool.request();
					approverRequest.input('EmployeeId', sql.Int, approvalLog.approverId);
					const approverResult = await approverRequest.query(`
						SELECT TOP 1 name, email, mobile
						FROM dbo.employee_master
						WHERE employee_id = @EmployeeId
						  AND is_active = 1
					`);

					const approver = approverResult?.recordset?.[0];
					if (!approver) continue;

					const approvalLink = buildApprovalQueueLink(prebookingId);
					const approveToken = createApprovalActionToken(approvalLog.approvalLogId, 'APPROVED');
					const rejectToken = createApprovalActionToken(approvalLog.approvalLogId, 'REJECTED');
					const approveLink = buildPublicApprovalActionLink(
						req,
						approvalLog.approvalLogId,
						'APPROVED',
						approveToken
					);
					const rejectLink = buildPublicApprovalActionLink(
						req,
						approvalLog.approvalLogId,
						'REJECTED',
						rejectToken
					);

					const approverEmails = normalizeEmailRecipients(approver.email);

					if (approverEmails.length > 0) {
						try {
							const emailText = [
								`Hello ${approver.name || 'there'},`,
								'',
								'A new visitor prebooking request has been submitted for approval.',
								`Visitor: ${VisitorName}`,
								`Email: ${VisitorEmail}`,
								'',
								`Approve: ${approveLink}`,
								`Reject: ${rejectLink}`,
								'',
								`Approval queue: ${approvalLink}`,
							].join('\n');

							await sendMail({
								to: approverEmails,
								subject: `Approval required for visitor prebooking - ${VisitorName}`,
								text: emailText,
								html: `
									<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
										<div style="background: #1d4ed8; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
											<h2 style="margin: 0;">New prebooking request requires your approval</h2>
										</div>
										<div style="padding: 24px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 8px 8px;">
											<p>Hello ${approver.name || 'there'},</p>
											<p>A new visitor prebooking request has been submitted for approval.</p>
											<ul>
												<li><strong>Visitor:</strong> ${VisitorName}</li>
												<li><strong>Email:</strong> ${VisitorEmail}</li>
											</ul>
											<p style="margin: 22px 0;">
												<a href="${approveLink}" style="background: #16a34a; color: white; padding: 10px 16px; text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 8px;">Approve</a>
												<a href="${rejectLink}" style="background: #dc2626; color: white; padding: 10px 16px; text-decoration: none; border-radius: 5px; display: inline-block;">Reject</a>
											</p>
											<p>If you want to review the full queue in the software, use this link:</p>
											<p><a href="${approvalLink}" style="color: #2563eb;">Open approval queue</a></p>
										</div>
									</div>
								`,
							});
							logger.info(
								`Approval notification email sent to ${approverEmails.join(', ')} for prebooking ${prebookingId}`
							);
						} catch (emailError) {
							logger.error(
								`Approval notification email failed for ${approverEmails.join(', ')}: message=${emailError?.message || emailError}; code=${emailError?.code || 'NA'}; response=${emailError?.response || 'NA'}`
							);
						}
					} else {
						logger.info(
							`Approval notification email skipped for approver ${approvalLog.approverId}: invalid or missing email (${approver.email || 'empty'})`
						);
					}

					// WhatsApp approval notification disabled.
				}
			} catch (notificationError) {
				logger.error(`Approval notification send failed: ${notificationError}`);
			}
		}

		if (isAutoApproved && prebookingId > 0) {
			const visitXml = `<VisitRequest><PreBookingID>${prebookingId}</PreBookingID></VisitRequest>`;
			const visitResult = await executeProcedureXml('CreateVisitTransaction_SP', 'main', visitXml);

			if (visitResult?.success && visitResult?.data?.Success === 'S') {
				gatePass = {
					visitId: visitResult?.data?.VisitID,
					referenceCode: visitResult?.data?.ReferenceCode,
				};
			} else {
				logger.error(`Auto-approved VIP visit transaction creation failed: ${visitResult?.error || 'Unknown error'}`);
			}
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Prebooking submitted',
			data: {
				...result?.data,
				gatePass,
			},
		});
	} catch (error) {
		logger.error(`There was an error during submitting prebooking form: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
