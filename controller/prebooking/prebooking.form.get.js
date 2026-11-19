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
import { buildFormGetXml } from './prebooking.utils.js';

export const getPrebookingForm = async (req, res, next) => {
	try {
		logger.info('getPrebookingForm API called');

		const errorResponse = await validateRequest(req, res, [
			RequiredRules.PrebookingTokenRule,
		]);
		if (errorResponse) return;

		const { Token } = req.body;
		const xmlData = buildFormGetXml({ Token });

		const result = await executeProcedureXml('Prebooking_Form_GetByToken_SP', 'main', xmlData);
		if (!result.success) {
			if (result.errorType === 'E') {
				logger.error(`Error fetching prebooking form: ${result?.error}`);
				return next(createError(STATUS_CODES.NOT_FOUND, result?.error));
			}
			logger.error(`Stored procedure failed fetching prebooking form: ${result?.error}`);
			return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
		}

		const rawItems = Array.isArray(result?.data?.Items)
			? result.data.Items
			: result?.data?.Items
				? [result.data.Items]
				: [];

		let finalData = result?.data;

		if (rawItems.length > 0) {
			const pool = await getDatabaseByTarget('main');
			const enrichedItems = await Promise.all(
				rawItems.map(async (item) => {
					const prebookingId = Number(item?.PrebookingId || 0);
					if (!Number.isInteger(prebookingId) || prebookingId <= 0) {
						return item;
					}

					try {
						const request = pool.request();
						request.input('PrebookingId', sql.Int, prebookingId);
						const detailResult = await request.query(`
							SELECT TOP 1
								pr.status AS RequestStatus,
								ps.visitor_photo AS SubmissionVisitorPhotoBase64,
								pm.name AS PurposeName,
								em.name AS MasterHostEmployeeName,
								vt.ReferenceCode,
								vt.VisitorPhotoBase64 AS VisitVisitorPhotoBase64,
								vt.ApprovalStatus,
								vt.VisitStatus,
								vt.GatePassValidTill,
								vt.EntryTime,
								vt.ExitTime,
								vt.HostEmployeeName,
								vt.DepartmentName,
								vt.Purpose AS VisitPurpose,
								al.ApprovalAction
							FROM dbo.prebooking_request pr
							LEFT JOIN dbo.prebooking_submission ps ON ps.prebooking_id = pr.prebooking_id
							LEFT JOIN dbo.purpose_master pm ON pm.purpose_id = ps.purpose_id
							LEFT JOIN dbo.employee_master em ON em.employee_id = pr.host_employee_id
							LEFT JOIN dbo.VISIT_TRANSACTION vt ON vt.PreBookingID = pr.prebooking_id
							OUTER APPLY (
								SELECT TOP 1
									val.action AS ApprovalAction
								FROM dbo.visit_approval_log val
								WHERE val.prebooking_id = pr.prebooking_id
								ORDER BY val.approval_log_id DESC
							) al
							WHERE pr.prebooking_id = @PrebookingId
							ORDER BY vt.VisitID DESC, pr.prebooking_id DESC;
						`);

						const details = detailResult?.recordset?.[0] || {};
						const requestStatus = details?.RequestStatus || item?.Status || null;
						const approvalStatus =
							details?.ApprovalStatus ||
							details?.ApprovalAction ||
							requestStatus ||
							item?.ApprovalStatus ||
							null;
						let referenceCode = details?.ReferenceCode || item?.ReferenceCode || null;
						const approved =
							String(approvalStatus || '').toUpperCase() === 'APPROVED' ||
							String(requestStatus || '').toUpperCase() === 'APPROVED';
						const rejected =
							String(approvalStatus || '').toUpperCase() === 'REJECTED' ||
							String(requestStatus || '').toUpperCase() === 'REJECTED';

						if (!referenceCode && approved) {
							try {
								const createVisitXml = `<VisitRequest><PreBookingID>${prebookingId}</PreBookingID></VisitRequest>`;
								const createVisitResult = await executeProcedureXml(
									'CreateVisitTransaction_SP',
									'main',
									createVisitXml
								);

								if (createVisitResult?.success && createVisitResult?.data?.Success === 'S') {
									referenceCode = createVisitResult?.data?.ReferenceCode || referenceCode;
								}
							} catch (visitCreateError) {
								logger.error(
									`Error auto-creating visit transaction for PrebookingId ${prebookingId}: ${visitCreateError}`
								);
							}
						}

						const visitorPhotoBase64 =
							details?.VisitVisitorPhotoBase64 ||
							details?.SubmissionVisitorPhotoBase64 ||
							item?.VisitorPhotoBase64 ||
							null;
						const showGatePass =
							!rejected &&
							approved &&
							Boolean(referenceCode);

						return {
							...item,
							RequestStatus: requestStatus,
							ApprovalStatus: approvalStatus,
							PurposeName: details?.PurposeName || details?.VisitPurpose || item?.PurposeName || null,
							HostEmployeeName:
								details?.HostEmployeeName ||
								details?.MasterHostEmployeeName ||
								item?.HostEmployeeName ||
								null,
							DepartmentName: details?.DepartmentName || item?.DepartmentName || null,
							ReferenceCode: referenceCode,
							VisitorPhotoBase64: visitorPhotoBase64,
							VisitStatus: details?.VisitStatus || item?.VisitStatus || null,
							GatePassValidTill: details?.GatePassValidTill || item?.GatePassValidTill || null,
							EntryTime: details?.EntryTime || item?.EntryTime || null,
							ExitTime: details?.ExitTime || item?.ExitTime || null,
							ShowGatePass: showGatePass ? 1 : 0,
						};
					} catch (detailError) {
						logger.error(
							`Error enriching prebooking form data for PrebookingId ${prebookingId}: ${detailError}`
						);
						return item;
					}
				})
			);

			finalData = {
				...result?.data,
				Items: Array.isArray(result?.data?.Items)
					? enrichedItems
					: enrichedItems[0] || result?.data?.Items,
			};
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Prebooking form fetched',
			data: finalData,
		});
	} catch (error) {
		logger.error(`There was an error during fetching prebooking form: ${error}`);
		return next(createError(STATUS_CODES.BAD_REQUEST, STATUS_MESSAGES.SERVER_ERROR));
	}
};
