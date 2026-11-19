import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	executeProcedureXml,
} from '../../utils/imports.js';
import QRCode from 'qrcode';

/**
 * Create visit transaction after approval
 * Called after visitor approval is granted
 */
export const createVisitTransaction = async (req, res, next) => {
	try {
		logger.info('createVisitTransaction API called');

		const { Token, PreBookingID } = req.body;

		if (!PreBookingID) {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, 'PreBookingID is required')
			);
		}

		const xmlData = `<VisitRequest>
			<PreBookingID>${PreBookingID}</PreBookingID>
		</VisitRequest>`;

		const result = await executeProcedureXml(
			'CreateVisitTransaction_SP',
			'main',
			xmlData
		);

		if (!result.success) {
			logger.error(`Error creating visit transaction: ${result?.error}`);
			return next(
				createError(
					STATUS_CODES.SERVER_ERROR,
					result?.error || STATUS_MESSAGES.SERVER_ERROR
				)
			);
		}

		const visitData = result?.data;

		if (visitData?.Success === 'E') {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, visitData?.Message)
			);
		}

		const visitID = visitData?.VisitID;
		const referenceCode = visitData?.ReferenceCode;

		// Generate QR code
		const qrCodeDataUrl = await QRCode.toDataURL(referenceCode, {
			errorCorrectionLevel: 'H',
			type: 'image/png',
			width: 300,
		});

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: 'Visit transaction created successfully',
			data: {
				visitID,
				referenceCode,
				qrCode: qrCodeDataUrl,
				status: 'PENDING_ENTRY',
			},
		});
	} catch (error) {
		logger.error(`Error in createVisitTransaction: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

/**
 * Get visit details by reference code
 * Used at entry gate kiosk
 */
export const getVisitByReferenceCode = async (req, res, next) => {
	try {
		logger.info('getVisitByReferenceCode API called');

		const { ReferenceCode } = req.body;

		if (!ReferenceCode) {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, 'ReferenceCode is required')
			);
		}

		const xmlData = `<VisitRequest>
			<ReferenceCode>${ReferenceCode}</ReferenceCode>
		</VisitRequest>`;

		const result = await executeProcedureXml(
			'GetVisitByReferenceCode_SP',
			'main',
			xmlData
		);

		if (!result.success) {
			logger.error(`Error fetching visit: ${result?.error}`);
			return next(
				createError(
					STATUS_CODES.SERVER_ERROR,
					result?.error || STATUS_MESSAGES.SERVER_ERROR
				)
			);
		}

		const visitData = result?.data;

		if (visitData?.Success === 'E') {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, visitData?.Message)
			);
		}

		if (!visitData?.VisitID) {
			return next(
				createError(STATUS_CODES.NOT_FOUND, 'Visit not found')
			);
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: 'Visit details fetched',
			data: {
				visitID: visitData?.VisitID,
				visitorName: visitData?.VisitorName,
				visitorEmail: visitData?.VisitorEmail,
				visitorMobile: visitData?.VisitorMobile,
				visitorPhoto: visitData?.VisitorPhotoBase64,
				purpose: visitData?.Purpose,
				hostEmployeeName: visitData?.HostEmployeeName,
				hostEmployeeMobile: visitData?.HostEmployeeMobile,
				departmentName: visitData?.DepartmentName,
				approvalStatus: visitData?.ApprovalStatus,
				visitStatus: visitData?.VisitStatus,
				ppeRequired: visitData?.PPERequired,
				ppeItems: visitData?.PPEItems,
				returnedPPEItems: visitData?.ReturnedPPEItems,
				referenceCode: visitData?.ReferenceCode,
				validTill: visitData?.GatePassValidTill,
			},
		});
	} catch (error) {
		logger.error(`Error in getVisitByReferenceCode: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

/**
 * Check in visitor at gate
 * Records PPE items given and entry time
 */
export const checkInVisitor = async (req, res, next) => {
	try {
		logger.info('checkInVisitor API called');

		const { VisitID, PPEItems, EntryGate, VerifiedByEmployeeID } = req.body;

		if (!VisitID) {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, 'VisitID is required')
			);
		}

		const xmlData = `<CheckInRequest>
			<VisitID>${VisitID}</VisitID>
			<PPEItems>${PPEItems || ''}</PPEItems>
			<EntryGate>${EntryGate || 'Main Gate'}</EntryGate>
			<VerifiedByEmployeeID>${VerifiedByEmployeeID || 0}</VerifiedByEmployeeID>
		</CheckInRequest>`;

		const result = await executeProcedureXml(
			'CheckInVisitor_SP',
			'main',
			xmlData
		);

		if (!result.success) {
			logger.error(`Error checking in visitor: ${result?.error}`);
			return next(
				createError(
					STATUS_CODES.SERVER_ERROR,
					result?.error || STATUS_MESSAGES.SERVER_ERROR
				)
			);
		}

		const checkInData = result?.data;

		if (checkInData?.Success === 'E') {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, checkInData?.Message)
			);
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: 'Visitor checked in successfully',
			data: {
				visitID: checkInData?.VisitID,
				visitorName: checkInData?.VisitorName,
				hostEmployeeName: checkInData?.HostEmployeeName,
				entryTime: checkInData?.EntryTime,
				status: checkInData?.VisitStatus,
				ppeItems: PPEItems,
			},
		});
	} catch (error) {
		logger.error(`Error in checkInVisitor: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

/**
 * Check out visitor at exit gate
 * Records exit time
 */
export const checkOutVisitor = async (req, res, next) => {
	try {
		logger.info('checkOutVisitor API called');

		const { VisitID, ExitGate, PPEItems } = req.body;

		if (!VisitID) {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, 'VisitID is required')
			);
		}

		const xmlData = `<CheckOutRequest>
			<VisitID>${VisitID}</VisitID>
			<ExitGate>${ExitGate || 'Main Gate'}</ExitGate>
			<PPEItems>${PPEItems || ''}</PPEItems>
		</CheckOutRequest>`;

		const result = await executeProcedureXml(
			'CheckOutVisitor_SP',
			'main',
			xmlData
		);

		if (!result.success) {
			logger.error(`Error checking out visitor: ${result?.error}`);
			return next(
				createError(
					STATUS_CODES.SERVER_ERROR,
					result?.error || STATUS_MESSAGES.SERVER_ERROR
				)
			);
		}

		const checkOutData = result?.data;

		if (checkOutData?.Success === 'E') {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, checkOutData?.Message)
			);
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: 'Visitor checked out successfully',
			data: {
				visitID: checkOutData?.VisitID,
				visitorName: checkOutData?.VisitorName,
				entryTime: checkOutData?.EntryTime,
				exitTime: checkOutData?.ExitTime,
				durationMinutes: checkOutData?.DurationMinutes,
				status: checkOutData?.VisitStatus,
				issuedPPEItems: checkOutData?.PPEItems,
				returnedPPEItems: checkOutData?.ReturnedPPEItems,
			},
		});
	} catch (error) {
		logger.error(`Error in checkOutVisitor: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

/**
 * Toggle visitor status by QR/reference code
 * First scan -> CHECK_IN, second scan -> CHECK_OUT
 */
export const toggleVisitByReferenceCode = async (req, res, next) => {
	try {
		logger.info('toggleVisitByReferenceCode API called');

		const { ReferenceCode, PPEItems, EntryGate, ExitGate, VerifiedByEmployeeID } = req.body;

		if (!ReferenceCode) {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, 'ReferenceCode is required')
			);
		}

		const lookupXml = `<VisitRequest>
			<ReferenceCode>${ReferenceCode}</ReferenceCode>
		</VisitRequest>`;

		const lookupResult = await executeProcedureXml(
			'GetVisitByReferenceCode_SP',
			'main',
			lookupXml
		);

		if (!lookupResult.success) {
			logger.error(`Error fetching visit for toggle: ${lookupResult?.error}`);
			return next(
				createError(
					STATUS_CODES.SERVER_ERROR,
					lookupResult?.error || STATUS_MESSAGES.SERVER_ERROR
				)
			);
		}

		const visitData = lookupResult?.data;

		if (visitData?.Success === 'E') {
			return next(
				createError(STATUS_CODES.BAD_REQUEST, visitData?.Message)
			);
		}

		if (!visitData?.VisitID) {
			return next(createError(STATUS_CODES.NOT_FOUND, 'Visit not found'));
		}

		const currentStatus = visitData?.VisitStatus;
		const visitID = visitData?.VisitID;

		if (currentStatus === 'PENDING_ENTRY') {
			const checkInXml = `<CheckInRequest>
				<VisitID>${visitID}</VisitID>
				<PPEItems>${PPEItems || ''}</PPEItems>
				<EntryGate>${EntryGate || 'Main Gate'}</EntryGate>
				<VerifiedByEmployeeID>${VerifiedByEmployeeID || 0}</VerifiedByEmployeeID>
			</CheckInRequest>`;

			const checkInResult = await executeProcedureXml(
				'CheckInVisitor_SP',
				'main',
				checkInXml
			);

			if (!checkInResult.success) {
				return next(
					createError(
						STATUS_CODES.SERVER_ERROR,
						checkInResult?.error || STATUS_MESSAGES.SERVER_ERROR
					)
				);
			}

			const checkInData = checkInResult?.data;
			if (checkInData?.Success === 'E') {
				return next(
					createError(STATUS_CODES.BAD_REQUEST, checkInData?.Message)
				);
			}

			return res.status(STATUS_CODES.OK).json({
				success: true,
				message: 'Visitor checked in successfully',
				data: {
					action: 'CHECK_IN',
					visitID: checkInData?.VisitID,
					visitorName: checkInData?.VisitorName,
					hostEmployeeName: checkInData?.HostEmployeeName,
					entryTime: checkInData?.EntryTime,
					status: checkInData?.VisitStatus,
				},
			});
		}

		if (currentStatus === 'CHECKED_IN') {
			const checkOutXml = `<CheckOutRequest>
				<VisitID>${visitID}</VisitID>
				<ExitGate>${ExitGate || EntryGate || 'Main Gate'}</ExitGate>
				<PPEItems>${PPEItems || ''}</PPEItems>
			</CheckOutRequest>`;

			const checkOutResult = await executeProcedureXml(
				'CheckOutVisitor_SP',
				'main',
				checkOutXml
			);

			if (!checkOutResult.success) {
				return next(
					createError(
						STATUS_CODES.SERVER_ERROR,
						checkOutResult?.error || STATUS_MESSAGES.SERVER_ERROR
					)
				);
			}

			const checkOutData = checkOutResult?.data;
			if (checkOutData?.Success === 'E') {
				return next(
					createError(STATUS_CODES.BAD_REQUEST, checkOutData?.Message)
				);
			}

			return res.status(STATUS_CODES.OK).json({
				success: true,
				message: 'Visitor checked out successfully',
				data: {
					action: 'CHECK_OUT',
					visitID: checkOutData?.VisitID,
					visitorName: checkOutData?.VisitorName,
					entryTime: checkOutData?.EntryTime,
					exitTime: checkOutData?.ExitTime,
					durationMinutes: checkOutData?.DurationMinutes,
					status: checkOutData?.VisitStatus,
					issuedPPEItems: checkOutData?.PPEItems,
					returnedPPEItems: checkOutData?.ReturnedPPEItems,
				},
			});
		}

		// Allow re-entry for CHECKED_OUT visitors (e.g., returning after lunch, forgot something)
		if (currentStatus === 'CHECKED_OUT' || currentStatus === 'COMPLETED') {
			const reCheckInXml = `<CheckInRequest>
				<VisitID>${visitID}</VisitID>
				<PPEItems>${PPEItems || ''}</PPEItems>
				<EntryGate>${EntryGate || 'Main Gate'}</EntryGate>
				<VerifiedByEmployeeID>${VerifiedByEmployeeID || 0}</VerifiedByEmployeeID>
			</CheckInRequest>`;

			const reCheckInResult = await executeProcedureXml(
				'CheckInVisitor_SP',
				'main',
				reCheckInXml
			);

			if (!reCheckInResult.success) {
				return next(
					createError(
						STATUS_CODES.SERVER_ERROR,
						reCheckInResult?.error || STATUS_MESSAGES.SERVER_ERROR
					)
				);
			}

			const reCheckInData = reCheckInResult?.data;
			if (reCheckInData?.Success === 'E') {
				return next(
					createError(STATUS_CODES.BAD_REQUEST, reCheckInData?.Message)
				);
			}

			return res.status(STATUS_CODES.OK).json({
				success: true,
				message: 'Visitor re-checked in successfully',
				data: {
					action: 'RE_CHECK_IN',
					visitID: reCheckInData?.VisitID,
					visitorName: reCheckInData?.VisitorName,
					hostEmployeeName: reCheckInData?.HostEmployeeName,
					entryTime: reCheckInData?.EntryTime,
					status: reCheckInData?.VisitStatus,
				},
			});
		}

		return next(
			createError(
				STATUS_CODES.BAD_REQUEST,
				`Visit is in ${currentStatus} status and cannot be toggled`
			)
		);
	} catch (error) {
		logger.error(`Error in toggleVisitByReferenceCode: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

/**
 * Get pending check-ins for today
 * Used at gate to show queue
 */
export const getPendingCheckIns = async (req, res, next) => {
	try {
		logger.info('getPendingCheckIns API called');

		const xmlData = `<CheckInRequest>
		</CheckInRequest>`;

		const result = await executeProcedureXml(
			'GetPendingCheckIns_SP',
			'main',
			xmlData
		);

		if (!result.success) {
			logger.error(`Error fetching pending check-ins: ${result?.error}`);
			return next(
				createError(
					STATUS_CODES.SERVER_ERROR,
					result?.error || STATUS_MESSAGES.SERVER_ERROR
				)
			);
		}

		const visits = Array.isArray(result?.data?.Table) ? result.data.Table : [];

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: `Found ${visits.length} pending check-ins`,
			data: visits.map((visit) => ({
				visitID: visit?.VisitID,
				referenceCode: visit?.ReferenceCode,
				visitorName: visit?.VisitorName,
				visitorEmail: visit?.VisitorEmail,
				visitorMobile: visit?.VisitorMobile,
				visitorPhoto: visit?.VisitorPhotoBase64,
				purpose: visit?.Purpose,
				hostEmployeeName: visit?.HostEmployeeName,
				departmentName: visit?.DepartmentName,
				approvalStatus: visit?.ApprovalStatus,
				visitStatus: visit?.VisitStatus,
				createdAt: visit?.CreatedAt,
			})),
		});
	} catch (error) {
		logger.error(`Error in getPendingCheckIns: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};
