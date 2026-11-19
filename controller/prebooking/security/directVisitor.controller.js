/**
 * Security Check Controller
 * Handles direct visitor entry without pre-booking requirement
 */

import { getDatabaseByTarget } from '../../../config/database.js';
import sql from 'mssql';
import { sendApprovalRequestEmail, sendRejectionEmail } from './directVisitor.emails.js';
import { createVisitTransaction, generateAndSendGatePass } from './directVisitor.visit.js';

/**
 * Create direct visitor security check request
 * POST /api/prebooking/security-check/create
 */
export const createDirectVisitorRequest = async (req, res) => {
	try {
		const {
			visitorName,
			visitorEmail,
			visitorMobile,
			visitorPhotoBase64,
			hostEmployeeId,
			approverId,
			idProofType,
			idProofNumber,
			remarks
		} = req.body;

		// Validate required fields
		if (!visitorName || !visitorEmail || !visitorMobile || !hostEmployeeId || !approverId) {
			return res.status(400).json({
				success: false,
				message: 'Missing required fields (visitor details, host, and approver required)',
				data: null
			});
		}

		const parsedHostEmployeeId = Number(hostEmployeeId);
		if (!Number.isInteger(parsedHostEmployeeId)) {
			return res.status(400).json({
				success: false,
				message: 'Invalid host employee id',
				data: null
			});
		}

		const parsedApproverId = Number(approverId);
		if (!Number.isInteger(parsedApproverId)) {
			return res.status(400).json({
				success: false,
				message: 'Invalid approver id',
				data: null
			});
		}

		const createdByUserId = req.user?.userId || req.user?.id;
		const createdByEmployeeId = createdByUserId ? Number(createdByUserId) : null;

		// Call stored procedure to create security check request
		const pool = await getDatabaseByTarget('main');
		const request = pool.request();
		request.input('VisitorName', visitorName);
		request.input('VisitorEmail', visitorEmail);
		request.input('VisitorMobile', visitorMobile);
		request.input('HostEmployeeId', sql.Int, parsedHostEmployeeId);
		request.input('ApproverId', sql.Int, parsedApproverId);
		request.input('IdProofType', idProofType || null);
		request.input('IdProofNumber', idProofNumber || null);
		request.input('VisitorRemarks', remarks || null);
		request.input('VisitorPhotoBase64', visitorPhotoBase64 || null);
		request.input('CreatedBy', sql.Int, createdByEmployeeId);
		request.output('ReferenceCode', sql.NVarChar(100));
		request.output('SecurityCheckId', sql.Int);

		const result = await request.execute('SecurityCheck_Create_SP');
		const securityCheckId =
			result.output?.SecurityCheckId ?? result.recordset?.[0]?.security_check_id;
		const referenceCode =
			result.output?.ReferenceCode ?? result.recordset?.[0]?.reference_code;

		if (securityCheckId && securityCheckId > 0) {
			// Send email to approver (not host)
			await sendApprovalRequestEmail(parsedApproverId, visitorName, visitorEmail, securityCheckId, referenceCode);

			return res.status(201).json({
				success: true,
				message: 'Direct visitor request submitted for approval',
				data: {
					securityCheckId,
					referenceCode,
					visitorName,
					visitorEmail
				}
			});
		} else {
			return res.status(500).json({
				success: false,
				message: 'Failed to create security check request',
				data: null
			});
		}

	} catch (error) {
		console.error('Error in createDirectVisitorRequest:', error);
		return res.status(500).json({
			success: false,
			message: 'Server error: ' + error.message,
			data: null
		});
	}
};

/**
 * Get pending security check requests for approver
 * GET /api/prebooking/security-check/pending
 */
export const getPendingRequests = async (req, res) => {
	try {
		const userId = req.user?.userId || req.user?.id;

		if (!userId) {
			return res.status(401).json({
				success: false,
				message: 'Unauthorized: User ID not found',
				data: null
			});
		}

		// Call stored procedure to list pending requests
		const pool = await getDatabaseByTarget('main');
		const request = pool.request();
		request.input('ApproverId', sql.Int, Number(userId));

		const result = await request.execute('SecurityCheck_ListPending_SP');

		return res.status(200).json({
			success: true,
			message: 'Pending security check requests retrieved',
			data: result.recordset || []
		});

	} catch (error) {
		console.error('Error in getPendingRequests:', error);
		return res.status(500).json({
			success: false,
			message: 'Server error: ' + error.message,
			data: null
		});
	}
};

/**
 * Get security check request details
 * GET /api/prebooking/security-check/:id
 */
export const getSecurityCheckDetails = async (req, res) => {
	try {
		const { id } = req.params;

		const pool = await getDatabaseByTarget('main');
		const request = pool.request();
		request.input('SecurityCheckId', sql.Int, parseInt(id, 10));

		const result = await request.execute('SecurityCheck_Get_SP');

		if (result.recordset && result.recordset.length > 0) {
			return res.status(200).json({
				success: true,
				message: 'Security check details retrieved',
				data: result.recordset[0]
			});
		} else {
			return res.status(404).json({
				success: false,
				message: 'Security check request not found',
				data: null
			});
		}

	} catch (error) {
		console.error('Error in getSecurityCheckDetails:', error);
		return res.status(500).json({
			success: false,
			message: 'Server error: ' + error.message,
			data: null
		});
	}
};

/**
 * Approve security check request
 * POST /api/prebooking/security-check/:id/approve
 */
export const approveSecurityCheck = async (req, res) => {
	try {
		const { id } = req.params;
		const { remarks } = req.body;
		const userId = req.user?.userId || req.user?.id;

		if (!id || !userId) {
			return res.status(400).json({
				success: false,
				message: 'Missing required parameters',
				data: null
			});
		}

		const approvedByEmployeeId = Number(userId);
		if (!Number.isInteger(approvedByEmployeeId)) {
			return res.status(400).json({
				success: false,
				message: 'Invalid approver employee id',
				data: null
			});
		}

		const pool = await getDatabaseByTarget('main');
		const request = pool.request();
		request.input('SecurityCheckId', sql.Int, parseInt(id, 10));
		request.input('ApprovedBy', sql.Int, approvedByEmployeeId);
		request.input('ApprovalRemarks', remarks || 'Approved');

		const result = await request.execute('SecurityCheck_Approve_SP');

		if (result.recordset[0]?.security_check_id > 0) {
			const securityCheckId = result.recordset[0].security_check_id;
			const referenceCode = result.recordset[0].reference_code;

			// Get visitor email to send gate pass
			const getRequest = pool.request();
			getRequest.input('SecurityCheckId', sql.Int, securityCheckId);
			const details = await getRequest.execute('SecurityCheck_Get_SP');

			if (details.recordset && details.recordset.length > 0) {
				const visitorData = details.recordset[0];

				// Create visit transaction
				const visitTransactionId = await createVisitTransaction(
					referenceCode,
					visitorData.visitor_name,
					visitorData.visitor_email,
					visitorData.visitor_mobile,
					approvedByEmployeeId
				);

				// Generate and send gate pass
				await generateAndSendGatePass(
					securityCheckId,
					referenceCode,
					visitorData.visitor_name,
					visitorData.visitor_email,
					visitorData.visitor_mobile,
					visitTransactionId
				);

				return res.status(200).json({
					success: true,
					message: 'Security check approved. Gate pass sent to visitor.',
					data: {
						securityCheckId,
						referenceCode,
						visitorName: visitorData.visitor_name,
						visitorEmail: visitorData.visitor_email
					}
				});
			}
		} else {
			return res.status(500).json({
				success: false,
				message: 'Failed to approve security check',
				data: null
			});
		}

	} catch (error) {
		console.error('Error in approveSecurityCheck:', error);
		return res.status(500).json({
			success: false,
			message: 'Server error: ' + error.message,
			data: null
		});
	}
};

/**
 * Reject security check request
 * POST /api/prebooking/security-check/:id/reject
 */
export const rejectSecurityCheck = async (req, res) => {
	try {
		const { id } = req.params;
		const { remarks } = req.body;
		const userId = req.user?.userId || req.user?.id;

		if (!id || !userId) {
			return res.status(400).json({
				success: false,
				message: 'Missing required parameters',
				data: null
			});
		}

		const rejectedByEmployeeId = Number(userId);
		if (!Number.isInteger(rejectedByEmployeeId)) {
			return res.status(400).json({
				success: false,
				message: 'Invalid rejector employee id',
				data: null
			});
		}

		const pool = await getDatabaseByTarget('main');
		const request = pool.request();
		request.input('SecurityCheckId', sql.Int, parseInt(id, 10));
		request.input('RejectedBy', sql.Int, rejectedByEmployeeId);
		request.input('RejectionRemarks', remarks || 'Rejected');

		const result = await request.execute('SecurityCheck_Reject_SP');

		if (result.recordset[0]?.security_check_id > 0) {
			// Get visitor email to notify rejection
			const getRequest = pool.request();
			getRequest.input('SecurityCheckId', sql.Int, parseInt(id, 10));
			const details = await getRequest.execute('SecurityCheck_Get_SP');

			if (details.recordset && details.recordset.length > 0) {
				const visitorData = details.recordset[0];

				// Send rejection email
				await sendRejectionEmail(
					visitorData.visitor_name,
					visitorData.visitor_email,
					remarks || 'Your security check request has been rejected.'
				);
			}

			return res.status(200).json({
				success: true,
				message: 'Security check rejected. Notification sent to visitor.',
				data: {
					securityCheckId: parseInt(id)
				}
			});
		} else {
			return res.status(500).json({
				success: false,
				message: 'Failed to reject security check',
				data: null
			});
		}

	} catch (error) {
		console.error('Error in rejectSecurityCheck:', error);
		return res.status(500).json({
			success: false,
			message: 'Server error: ' + error.message,
			data: null
		});
	}
};
