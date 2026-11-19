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

const buildTemplateGetXml = ({ TemplateCode }) =>
	`<Template><TemplateCode>${escapeXml(TemplateCode)}</TemplateCode></Template>`;

const buildTemplateListXml = ({ OnlyActive } = {}) =>
	OnlyActive === undefined || OnlyActive === null
		? '<Template></Template>'
		: `<Template><OnlyActive>${escapeXml(OnlyActive)}</OnlyActive></Template>`;

const buildTemplateCreateXml = ({ TemplateCode, Subject, BodyHtml }) =>
	`<Template><TemplateCode>${escapeXml(
		TemplateCode
	)}</TemplateCode><Subject>${escapeXml(Subject)}</Subject><BodyHtml>${escapeXml(
		BodyHtml
	)}</BodyHtml></Template>`;

const buildTemplateUpdateXml = ({ TemplateId, Subject, BodyHtml }) =>
	`<Template><TemplateId>${escapeXml(
		TemplateId
	)}</TemplateId><Subject>${escapeXml(Subject)}</Subject><BodyHtml>${escapeXml(
		BodyHtml
	)}</BodyHtml></Template>`;

const buildTemplateToggleXml = ({ TemplateId, IsActive }) =>
	`<Template><TemplateId>${escapeXml(
		TemplateId
	)}</TemplateId><IsActive>${escapeXml(IsActive)}</IsActive></Template>`;

const buildRequestCreateXml = ({
	VisitorName,
	VisitorEmail,
	HostEmployeeId,
	DepartmentId,
	VisitDate,
}) => {
	const hostEmployeeNode =
		HostEmployeeId === undefined || HostEmployeeId === null || String(HostEmployeeId).trim() === ''
			? ''
			: `<HostEmployeeId>${escapeXml(HostEmployeeId)}</HostEmployeeId>`;

	return `<Prebooking><VisitorName>${escapeXml(
		VisitorName
	)}</VisitorName><VisitorEmail>${escapeXml(
		VisitorEmail
	)}</VisitorEmail>${hostEmployeeNode}<DepartmentId>${escapeXml(
		DepartmentId
	)}</DepartmentId><VisitDate>${escapeXml(VisitDate)}</VisitDate></Prebooking>`;
};

const buildRequestGetByTokenXml = ({ Token }) =>
	`<Prebooking><Token>${escapeXml(Token)}</Token></Prebooking>`;

const buildFormGetXml = ({ Token }) =>
	`<Prebooking><Token>${escapeXml(Token)}</Token></Prebooking>`;

const buildFormSubmitXml = ({
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
}) =>
	`<Prebooking><Token>${escapeXml(Token)}</Token><VisitorName>${escapeXml(
		VisitorName
	)}</VisitorName><VisitorEmail>${escapeXml(
		VisitorEmail
	)}</VisitorEmail><VisitorMobile>${escapeXml(
		VisitorMobile
	)}</VisitorMobile><VisitorPhotoBase64>${escapeXml(
		VisitorPhotoBase64
	)}</VisitorPhotoBase64><IdProofId>${escapeXml(
		IdProofId
	)}</IdProofId><IdProofNumber>${escapeXml(
		IdProofNumber
	)}</IdProofNumber><PurposeId>${escapeXml(
		PurposeId
	)}</PurposeId><HostEmployeeId>${escapeXml(
		HostEmployeeId ?? ''
	)}</HostEmployeeId><VisitDate>${escapeXml(
		VisitDate
	)}</VisitDate><VisitTimeSlot>${escapeXml(
		VisitTimeSlot
	)}</VisitTimeSlot><CompanyName>${escapeXml(
		CompanyName ?? ''
	)}</CompanyName><Address>${escapeXml(Address ?? '')}</Address><Notes>${escapeXml(
		Notes ?? ''
	)}</Notes></Prebooking>`;

const buildRequestListXml = ({ Status, FromDate, ToDate } = {}) =>
	`<Prebooking><Status>${escapeXml(
		Status ?? ''
	)}</Status><FromDate>${escapeXml(
		FromDate ?? ''
	)}</FromDate><ToDate>${escapeXml(ToDate ?? '')}</ToDate></Prebooking>`;

const buildVisitorReportListXml = ({
	FromDate,
	ToDate,
	Search,
	PurposeId,
	VisitorType,
	VisitStatus,
	ApprovalStatus,
	PageNumber,
	PageSize,
} = {}) =>
	`<VisitorReport><FromDate>${escapeXml(
		FromDate ?? ''
	)}</FromDate><ToDate>${escapeXml(ToDate ?? '')}</ToDate><Search>${escapeXml(
		Search ?? ''
	)}</Search><PurposeId>${escapeXml(PurposeId ?? '')}</PurposeId><VisitorType>${escapeXml(
		VisitorType ?? ''
	)}</VisitorType><VisitStatus>${escapeXml(
		VisitStatus ?? ''
	)}</VisitStatus><ApprovalStatus>${escapeXml(
		ApprovalStatus ?? ''
	)}</ApprovalStatus><PageNumber>${escapeXml(
		PageNumber ?? 1
	)}</PageNumber><PageSize>${escapeXml(PageSize ?? 10)}</PageSize></VisitorReport>`;

const buildHomeDashboardXml = ({ ForDate } = {}) =>
	`<Dashboard><ForDate>${escapeXml(ForDate ?? '')}</ForDate></Dashboard>`;

const normalizeBaseUrl = (value) => {
	if (!value) {
		return '';
	}

	return String(value).trim().replace(/\/+$/, '');
};

const resolveFrontendBaseUrl = () => {
	const candidateUrls = [
		process.env.FRONTEND_URL,
		process.env.PUBLIC_BASE_URL,
		process.env.PREBOOKING_FORM_BASE_URL,
	]
		.map(normalizeBaseUrl)
		.filter(Boolean);

	for (const candidate of candidateUrls) {
		if (/^https?:\/\//i.test(candidate)) {
			return normalizeBaseUrl(candidate);
		}
	}

	return '';
};

const buildApprovalQueueLink = (prebookingId) => {
	const baseUrl = resolveFrontendBaseUrl();
	const path = baseUrl ? `${baseUrl}/prebooking/approvals` : '/prebooking/approvals';
	const separator = path.includes('?') ? '&' : '?';
	return `${path}${separator}prebookingId=${encodeURIComponent(prebookingId)}`;
};

const resolveApiBaseUrl = (req) => {
	const candidateUrls = [
		process.env.API_PUBLIC_BASE_URL,
		process.env.PUBLIC_API_BASE_URL,
	]
		.map(normalizeBaseUrl)
		.filter(Boolean);

	for (const candidate of candidateUrls) {
		if (/^https?:\/\//i.test(candidate)) {
			return normalizeBaseUrl(candidate);
		}
	}

	const protocol = (req?.headers?.['x-forwarded-proto'] || req?.protocol || 'https')
		.toString()
		.split(',')[0]
		.trim();
	const host = (req?.headers?.['x-forwarded-host'] || req?.headers?.host || req?.get?.('host') || '')
		.toString()
		.split(',')[0]
		.trim();

	return host ? `${protocol}://${host}` : '';
};

const buildPublicApprovalActionLink = (req, approvalLogId, action, token) => {
	const baseUrl = resolveApiBaseUrl(req);
	const path = `${baseUrl}/api/prebooking/public/approval/decision`;
	const params = new URLSearchParams({
		approvalLogId: String(approvalLogId),
		action: String(action),
		token: String(token),
	});

	return `${path}?${params.toString()}`;
};

const resolveFormBaseUrl = (req) => {
	const candidateUrls = [
		process.env.PREBOOKING_FORM_BASE_URL,
		process.env.PUBLIC_BASE_URL,
		process.env.FRONTEND_URL,
	]
		.map(normalizeBaseUrl)
		.filter(Boolean);

	for (const candidate of candidateUrls) {
		if (/^https?:\/\//i.test(candidate)) {
			const normalizedCandidate = candidate.replace(/\/+$/, '');
			if (/\/prebooking\/form$/i.test(normalizedCandidate)) {
				return normalizedCandidate;
			}

			return `${normalizedCandidate}/prebooking/form`;
		}
	}

	const protocol = (req.headers['x-forwarded-proto'] || req.protocol || 'https')
		.toString()
		.split(',')[0]
		.trim();
	const host = (req.headers['x-forwarded-host'] || req.headers.host || req.get('host') || '')
		.toString()
		.split(',')[0]
		.trim();

	if (host) {
		return `${protocol}://${host}/prebooking/form`;
	}

	return null;
};

const buildFormLink = (req, token) => {
	const baseUrl = resolveFormBaseUrl(req);
	if (!baseUrl) {
		return '';
	}

	const separator = baseUrl.includes('?') ? '&' : '?';
	return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
};

export {
	buildTemplateGetXml,
	buildTemplateListXml,
	buildTemplateCreateXml,
	buildTemplateUpdateXml,
	buildTemplateToggleXml,
	buildRequestCreateXml,
	buildRequestGetByTokenXml,
	buildRequestListXml,
	buildVisitorReportListXml,
	buildHomeDashboardXml,
	buildFormGetXml,
	buildFormSubmitXml,
	resolveFrontendBaseUrl,
	resolveApiBaseUrl,
	buildApprovalQueueLink,
	buildPublicApprovalActionLink,
	resolveFormBaseUrl,
	buildFormLink,
};
