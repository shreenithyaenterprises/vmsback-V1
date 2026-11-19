/**
 * Security Check - Email Helpers
 * Handles all email notifications for security check workflow
 */

import { getDatabaseByTarget } from '../../../config/database.js';
import { sendMail } from '../../../utils/mailer.js';

/**
 * Send approval request email to approving authority
 */
export const sendApprovalRequestEmail = async (approverId, visitorName, visitorEmail, securityCheckId, referenceCode) => {
	try {
		// Get approver details
		const pool = await getDatabaseByTarget('main');
		const request = pool.request();
		request.input('EmployeeId', approverId);
		const result = await request.query('SELECT name, email FROM EMPLOYEE_MASTER WHERE employee_id = @EmployeeId');

		if (result.recordset && result.recordset.length > 0) {
			const approverEmail = result.recordset[0].email;
			const approverName = result.recordset[0].name;

			const mailOptions = {
				to: approverEmail,
				subject: `🔐 New Security Check Request - ${visitorName}`,
				html: `
					<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
						<div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
							<h1 style="margin: 0; font-size: 28px;">🔐 NEW SECURITY CHECK REQUEST</h1>
						</div>

						<div style="background: white; padding: 40px; border: 1px solid #ddd;">
							<h2 style="color: #333; margin-top: 0;">Hello ${approverName},</h2>
							
							<p style="color: #666; font-size: 16px; line-height: 1.6;">
								A new visitor security check request requires your approval.
							</p>

							<div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 30px 0;">
								<table style="width: 100%; color: #666;">
									<tr style="border-bottom: 1px solid #ddd;">
										<td style="padding: 10px 0; font-weight: bold; width: 30%;">Visitor Name:</td>
										<td style="padding: 10px 0;">${visitorName}</td>
									</tr>
									<tr style="border-bottom: 1px solid #ddd;">
										<td style="padding: 10px 0; font-weight: bold;">Visitor Email:</td>
										<td style="padding: 10px 0;">${visitorEmail}</td>
									</tr>
									<tr style="border-bottom: 1px solid #ddd;">
										<td style="padding: 10px 0; font-weight: bold;">Reference Code:</td>
										<td style="padding: 10px 0;"><strong style="color: #ff6b6b;">${referenceCode}</strong></td>
									</tr>
									<tr>
										<td style="padding: 10px 0; font-weight: bold;">Request ID:</td>
										<td style="padding: 10px 0;">${securityCheckId}</td>
									</tr>
								</table>
							</div>

							<div style="text-align: center; margin: 30px 0;">
								<a href="${process.env.FRONTEND_URL || 'https://vms.radiantpathngp.com'}/prebooking/security-check/approve/${securityCheckId}" 
									style="background: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 10px;">
									✓ Approve
								</a>
								<a href="${process.env.FRONTEND_URL || 'https://vms.radiantpathngp.com'}/prebooking/security-check/reject/${securityCheckId}" 
									style="background: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
									✕ Reject
								</a>
							</div>

							<p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
								Please review and take action on this security check request at your earliest convenience.
							</p>
						</div>
					</div>
				`
			};

			await sendMail(mailOptions);
		}

	} catch (error) {
		console.error('Error sending approval request email:', error);
		// Don't throw - continue even if email fails
	}
};

/**
 * Send gate pass approval email to visitor
 */
export const sendGatePassEmail = async (visitorName, visitorEmail, visitorMobile, referenceCode, qrCodeImage) => {
	try {
		const mailOptions = {
			to: visitorEmail,
			subject: `🎟️ Your Gate Pass is Ready - Security Check Approved`,
			html: `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
						<h1 style="margin: 0; font-size: 28px;">✓ GATE PASS APPROVED</h1>
						<p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">Your security check has been approved</p>
					</div>

					<div style="background: white; padding: 40px; border: 1px solid #ddd; text-align: center;">
						<h2 style="color: #333; margin-top: 0;">Hello ${visitorName},</h2>
						
						<p style="color: #666; font-size: 16px; line-height: 1.6;">
							Your visitor security check has been <strong style="color: #27ae60;">APPROVED</strong>. 
							Please find your gate pass barcode below.
						</p>

						<div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 30px 0;">
							<p style="color: #666; font-size: 14px; margin-top: 0;">Reference Code:</p>
							<p style="font-size: 22px; font-weight: bold; color: #667eea; margin: 10px 0;">${referenceCode}</p>
						</div>

						<div style="margin: 30px 0; padding: 20px; background: #f0f0f0; border-radius: 8px;">
							<img src="${qrCodeImage}" alt="Gate Pass QR Code" style="width: 200px; height: 200px; margin: 0 auto; display: block;" />
						</div>

						<div style="background: #fffbea; border-left: 4px solid #ffc107; padding: 15px 20px; margin: 30px 0; text-align: left;">
							<h4 style="color: #e67e22; margin-top: 0;">📋 Instructions:</h4>
							<ol style="color: #666; margin: 0; padding-left: 20px;">
								<li>Save or print this email</li>
								<li>Scan the QR code at the gate entrance</li>
								<li>Reference Code: <strong>${referenceCode}</strong></li>
								<li>Proceed to designated area</li>
							</ol>
						</div>

						<div style="background: #e8f5e9; border-left: 4px solid #27ae60; padding: 15px 20px; margin: 30px 0;">
							<p style="color: #27ae60; margin: 0;">
								<strong>✓</strong> Mobile Number: ${visitorMobile}
							</p>
						</div>

						<p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
							This is an automated message. If you have any questions, please contact the security team.<br/>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`
		};

		await sendMail(mailOptions);

	} catch (error) {
		console.error('Error sending gate pass email:', error);
		throw error;
	}
};

/**
 * Send rejection email to visitor
 */
export const sendRejectionEmail = async (visitorName, visitorEmail, remarks) => {
	try {
		const mailOptions = {
			to: visitorEmail,
			subject: `❌ Security Check Rejected`,
			html: `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 40px; text-align: center; border-radius: 10px 10px 0 0;">
						<h1 style="margin: 0; font-size: 28px;">❌ REQUEST REJECTED</h1>
					</div>

					<div style="background: white; padding: 40px; border: 1px solid #ddd;">
						<h2 style="color: #333; margin-top: 0;">Hello ${visitorName},</h2>
						
						<p style="color: #666; font-size: 16px; line-height: 1.6;">
							Unfortunately, your security check request has been <strong style="color: #e74c3c;">REJECTED</strong>.
						</p>

						<div style="background: #ffe0e0; border-left: 4px solid #e74c3c; padding: 15px 20px; margin: 30px 0;">
							<p style="color: #c0392b; margin: 0;">
								<strong>Reason:</strong><br/>
								${remarks || 'No reason provided'}
							</p>
						</div>

						<p style="color: #666; font-size: 14px;">
							If you believe this is an error, please contact the security department.
						</p>

						<p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
							This is an automated message. Please do not reply to this email.
						</p>
					</div>
				</div>
			`
		};

		await sendMail(mailOptions);

	} catch (error) {
		console.error('Error sending rejection email:', error);
		// Don't throw - continue even if email fails
	}
};
