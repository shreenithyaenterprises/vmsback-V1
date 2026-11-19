/**
 * Security Check - Visit Transaction & Gate Pass Helpers
 * Handles visit transaction creation and gate pass generation
 */

import { getDatabaseByTarget } from '../../../config/database.js';
import QRCode from 'qrcode';
import { sendGatePassEmail } from './directVisitor.emails.js';

/**
 * Create visit transaction record
 * Used when security check is approved
 */
export const createVisitTransaction = async (referenceCode, visitorName, visitorEmail, visitorMobile, userId) => {
	try {
		const pool = await getDatabaseByTarget('main');
		const request = pool.request();

		request.input('ReferenceCode', referenceCode);
		request.input('VisitorName', visitorName);
		request.input('VisitorEmail', visitorEmail);
		request.input('VisitorMobile', visitorMobile);
		request.input('VisitStatus', 'PENDING_ENTRY');
		request.input('CreatedBy', userId);

		const result = await request.query(`
			INSERT INTO VISIT_TRANSACTION (
				reference_code, visitor_name, visitor_email, visitor_mobile,
				visit_status, created_at, created_by
			) VALUES (
				@ReferenceCode, @VisitorName, @VisitorEmail, @VisitorMobile,
				@VisitStatus, GETDATE(), @CreatedBy
			);
			SELECT SCOPE_IDENTITY() as visit_id;
		`);

		return result.recordset[0].visit_id;

	} catch (error) {
		console.error('Error creating visit transaction:', error);
		throw error;
	}
};

/**
 * Generate QR code and send gate pass email to visitor
 */
export const generateAndSendGatePass = async (
	securityCheckId,
	referenceCode,
	visitorName,
	visitorEmail,
	visitorMobile,
	visitTransactionId
) => {
	try {
		// Generate QR code data
		const qrCodeData = JSON.stringify({
			referenceCode,
			visitorName,
			visitorEmail,
			visitorMobile,
			visitorId: `SEC_${securityCheckId}`,
			createdAt: new Date().toISOString()
		});

		// Create QR code image
		const qrCodeImage = await QRCode.toDataURL(qrCodeData);

		// Update gate pass in database
		const pool = await getDatabaseByTarget('main');
		const request = pool.request();
		request.input('SecurityCheckId', securityCheckId);
		request.input('GatePassQRBase64', qrCodeImage);
		request.input('VisitTransactionId', visitTransactionId);

		await request.execute('SecurityCheck_UpdateGatePass_SP');

		// Send gate pass email
		await sendGatePassEmail(visitorName, visitorEmail, visitorMobile, referenceCode, qrCodeImage);

	} catch (error) {
		console.error('Error generating/sending gate pass:', error);
		throw error;
	}
};
