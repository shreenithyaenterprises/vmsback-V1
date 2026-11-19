import {
	STATUS_CODES,
	STATUS_MESSAGES,
	createError,
	logger,
	executeProcedureXml,
	getDatabaseByTarget,
	sql,
} from '../../utils/imports.js';

const escapeXml = (value = '') =>
	String(value).replace(/[<>&'\"]/g, (ch) => {
		switch (ch) {
			case '<':
				return '&lt;';
			case '>':
				return '&gt;';
			case '&':
				return '&amp;';
			case "'":
				return '&apos;';
			case '"':
				return '&quot;';
			default:
				return ch;
		}
	});

const parseJsonItems = (value) => {
	if (Array.isArray(value)) return value;
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}
	return [];
};

const createRequestXml = ({
	checkInDate,
	employeeId,
	purposeOfVisit,
	visitorName,
	companyLocation,
	visitorMobile,
	visitorEmail,
	visitorPhotoBase64,
	approverEmployeeId,
}) =>
	`<CeatInterplant><CheckInDate>${escapeXml(
		checkInDate
	)}</CheckInDate><EmployeeId>${escapeXml(employeeId)}</EmployeeId><PurposeOfVisit>${escapeXml(
		purposeOfVisit
	)}</PurposeOfVisit><VisitorName>${escapeXml(visitorName)}</VisitorName><CompanyLocation>${escapeXml(
		companyLocation
	)}</CompanyLocation><VisitorMobile>${escapeXml(
		visitorMobile
	)}</VisitorMobile><VisitorEmail>${escapeXml(
		visitorEmail
	)}</VisitorEmail><VisitorPhotoBase64>${escapeXml(visitorPhotoBase64 || '')}</VisitorPhotoBase64><ApproverEmployeeId>${escapeXml(
		approverEmployeeId
	)}</ApproverEmployeeId></CeatInterplant>`;

const tokenXml = (token) => `<CeatInterplant><Token>${escapeXml(token)}</Token></CeatInterplant>`;

const approverXml = (approverEmployeeId) =>
	`<CeatInterplant><ApproverEmployeeId>${escapeXml(approverEmployeeId)}</ApproverEmployeeId></CeatInterplant>`;

const decisionXml = ({ requestId, action, remarks, approverEmployeeId }) =>
	`<CeatInterplant><RequestId>${escapeXml(requestId)}</RequestId><Action>${escapeXml(
		action
	)}</Action><Remarks>${escapeXml(remarks || '')}</Remarks><ApproverEmployeeId>${escapeXml(
		approverEmployeeId
	)}</ApproverEmployeeId></CeatInterplant>`;

const forDateXml = (forDate) =>
	forDate
		? `<CeatInterplant><ForDate>${escapeXml(forDate)}</ForDate></CeatInterplant>`
		: '<CeatInterplant></CeatInterplant>';

const resolveApproverEmployeeId = async (req) => {
	const raw = req.user?.userId ?? req.user?.id;
	if (!raw) return null;

	const parsed = Number(raw);
	if (Number.isInteger(parsed) && parsed > 0) {
		return parsed;
	}

	const pool = await getDatabaseByTarget('main');
	if (!pool) return null;

	const request = pool.request();
	request.input('UserId', sql.NVarChar(160), String(raw));

	const result = await request.query(`
		SELECT TOP 1 employee_id AS EmployeeId
		FROM dbo.employee_master
		WHERE ISNULL(is_active, 1) = 1
		  AND (
			email = @UserId
			OR mobile = @UserId
		  )
	`);

	const employeeId = result?.recordset?.[0]?.EmployeeId;
	return employeeId ? Number(employeeId) : null;
};

export const createCeatInterplantRequest = async (req, res, next) => {
	try {
		logger.info('createCeatInterplantRequest API called');
		const {
			CheckInDate,
			EmployeeId,
			PurposeOfVisit,
			VisitorName,
			CompanyLocation,
			VisitorMobile,
			VisitorEmail,
			VisitorPhotoBase64,
			ApproverEmployeeId,
		} = req.body || {};

		const xmlData = createRequestXml({
			checkInDate: CheckInDate,
			employeeId: EmployeeId,
			purposeOfVisit: PurposeOfVisit,
			visitorName: VisitorName,
			companyLocation: CompanyLocation,
			visitorMobile: VisitorMobile,
			visitorEmail: VisitorEmail,
			visitorPhotoBase64: VisitorPhotoBase64,
			approverEmployeeId: ApproverEmployeeId,
		});

		const result = await executeProcedureXml('CeatInterplant_Create_SP', 'main', xmlData);
		if (!result.success) {
			return next(createError(STATUS_CODES.BAD_REQUEST, result?.error || STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.CREATED).json({
			success: true,
			message: result?.data?.Message || 'Request submitted',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`Error in createCeatInterplantRequest: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

export const getCeatInterplantLookups = async (_req, res, next) => {
	try {
		logger.info('getCeatInterplantLookups API called');
		const result = await executeProcedureXml('CeatInterplant_Lookups_SP', 'main', '<CeatInterplant></CeatInterplant>');
		if (!result.success) {
			return next(createError(STATUS_CODES.SERVER_ERROR, result?.error || STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Lookups fetched',
			data: {
				approvers: parseJsonItems(result?.data?.Approvers),
			},
		});
	} catch (error) {
		logger.error(`Error in getCeatInterplantLookups: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

export const getCeatInterplantStatusByToken = async (req, res, next) => {
	try {
		logger.info('getCeatInterplantStatusByToken API called');
		const { Token } = req.body || {};
		if (!Token) {
			return next(createError(STATUS_CODES.BAD_REQUEST, 'Token is required'));
		}

		const result = await executeProcedureXml('CeatInterplant_Status_ByToken_SP', 'main', tokenXml(Token));
		if (!result.success) {
			return next(createError(STATUS_CODES.BAD_REQUEST, result?.error || STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Status fetched',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`Error in getCeatInterplantStatusByToken: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

export const getCeatInterplantPendingApprovals = async (req, res, next) => {
	try {
		logger.info('getCeatInterplantPendingApprovals API called');
		const approverEmployeeId = await resolveApproverEmployeeId(req);
		if (!approverEmployeeId) {
			return next(createError(STATUS_CODES.BAD_REQUEST, 'Approver employee id not found in token'));
		}

		const result = await executeProcedureXml(
			'CeatInterplant_Pending_ForApprover_SP',
			'main',
			approverXml(approverEmployeeId)
		);
		if (!result.success) {
			return next(createError(STATUS_CODES.BAD_REQUEST, result?.error || STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Pending approvals fetched',
			data: {
				items: parseJsonItems(result?.data?.Items),
			},
		});
	} catch (error) {
		logger.error(`Error in getCeatInterplantPendingApprovals: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

export const submitCeatInterplantDecision = async (req, res, next) => {
	try {
		logger.info('submitCeatInterplantDecision API called');
		const approverEmployeeId = await resolveApproverEmployeeId(req);
		if (!approverEmployeeId) {
			return next(createError(STATUS_CODES.BAD_REQUEST, 'Approver employee id not found in token'));
		}

		const { RequestId, Action, Remarks } = req.body || {};
		if (!RequestId || !Action) {
			return next(createError(STATUS_CODES.BAD_REQUEST, 'RequestId and Action are required'));
		}

		const result = await executeProcedureXml(
			'CeatInterplant_Decision_SP',
			'main',
			decisionXml({
				requestId: RequestId,
				action: Action,
				remarks: Remarks,
				approverEmployeeId,
			})
		);
		if (!result.success) {
			return next(createError(STATUS_CODES.BAD_REQUEST, result?.error || STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Decision submitted',
			data: result?.data,
		});
	} catch (error) {
		logger.error(`Error in submitCeatInterplantDecision: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};

export const getCeatInterplantDashboardList = async (req, res, next) => {
	try {
		logger.info('getCeatInterplantDashboardList API called');
		const { ForDate } = req.body || {};
		const result = await executeProcedureXml('CeatInterplant_Dashboard_List_SP', 'main', forDateXml(ForDate));
		if (!result.success) {
			return next(createError(STATUS_CODES.BAD_REQUEST, result?.error || STATUS_MESSAGES.SERVER_ERROR));
		}

		return res.status(STATUS_CODES.OK).json({
			success: true,
			message: result?.data?.Message || 'Dashboard entries fetched',
			data: {
				forDate: result?.data?.ForDate || null,
				items: parseJsonItems(result?.data?.Items),
			},
		});
	} catch (error) {
		logger.error(`Error in getCeatInterplantDashboardList: ${error}`);
		return next(createError(STATUS_CODES.SERVER_ERROR, STATUS_MESSAGES.SERVER_ERROR));
	}
};
